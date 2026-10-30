// UC-60 Quan ly danh muc thu tuc (them, sua, an/hien) va UC-61 Cai giay to cho thu tuc
// (Bat buoc / Khong bat buoc) - xem Hinh 3.4, 3.6 trong bao cao.
//
// Quy tac (theo so do):
//  - Nhom quyen SERVICE_DOCS: Dieu phoi (SUPERVISOR), Truong Trung tam (MANAGER), Quan tri vien (SUPER_ADMIN).
//  - Can bo Quay (OFFICER) chi dung UC-61, va CHI cho thu tuc thuoc linh vuc cua quay minh phu trach.
//  - Chong ghi de: moi lan luu phai gui kem `version` (updated_at luc tai) - neu nguoi khac da luu
//    truoc thi tra 409 de nguoi dung tai lai thay vi am tham de len thay doi cua nguoi kia.
//  - Thu tuc moi MAC DINH AN; cai it nhat 1 giay to xong moi duoc hien. KHONG xoa thu tuc, chi an/hien
//    (ve cu va bao cao van tro toi thu tuc do).
//  - Moi thay doi ghi Audit Log (UPDATE_SERVICE_DOCS...) va phat su kien SERVICE_DOCS_UPDATED.
const { pool, withTransaction } = require('../config/db');
const serviceRepo = require('../repositories/serviceRepository');
const counterRepo = require('../repositories/counterRepository');
const auditRepo = require('../repositories/auditRepository');
const wsHub = require('../websocket/wsHub');
const {
  normalizeRequiredDocs, normalizeServiceInfo, normalizeNewService
} = require('../utils/serviceDocs');
const { ValidationError } = require('../utils/validate');

const CATALOG_ROLES = ['SUPER_ADMIN', 'MANAGER', 'SUPERVISOR'];

// Loi nghiep vu kem ma HTTP de route tra dung 403/404/409 thay vi 400 chung chung.
class CatalogError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
const forbidden = (msg) => new CatalogError(msg, 403);
const notFound = () => new CatalogError('Thu tuc khong ton tai.', 404);

// version = updated_at luc nguoi dung tai man hinh (ISO). So sanh theo moc thoi gian (ms).
function toVersion(row) {
  return new Date(row.updated_at).toISOString();
}

function present(service) {
  if (!service) return null;
  const { updated_at: _u, ...rest } = service;
  return { ...rest, version: toVersion(service) };
}

function assertVersion(service, version) {
  if (!version) throw new ValidationError('Thieu phien ban du lieu (version). Vui long tai lai trang.');
  const sent = new Date(version).getTime();
  if (!Number.isFinite(sent)) throw new ValidationError('Phien ban du lieu (version) khong hop le.');
  if (sent !== new Date(service.updated_at).getTime()) {
    throw new CatalogError('Thu tuc nay vua duoc nguoi khac thay doi. Vui long tai lai de xem ban moi nhat roi sua lai.', 409);
  }
}

// Cac linh vuc (field_id) ma Can bo Quay dang phu trach (qua cac quay duoc phan cong cho minh).
async function officerFieldIds(client, staffId) {
  const counters = await counterRepo.listAll(client);
  return [...new Set(counters.filter((c) => c.officer_id === staffId).map((c) => c.field_id))];
}

function isCatalogRole(role) {
  return CATALOG_ROLES.includes(role);
}

// Duoc cai giay to cho thu tuc nay khong (UC-61)?
async function assertCanEditDocs(client, actor, service) {
  if (isCatalogRole(actor.role)) return;
  if (actor.role === 'OFFICER') {
    const fields = await officerFieldIds(client, actor.staffId);
    if (!fields.includes(service.field_id)) {
      throw forbidden('Ban chi duoc cai giay to cho thu tuc thuoc linh vuc cua quay minh phu trach.');
    }
    return;
  }
  throw forbidden('Vai tro cua ban khong co quyen cai giay to cho thu tuc.');
}

// Chi 3 vai tro quan ly moi duoc them/sua thong tin/le phi/an-hien (UC-60).
function assertCanManageCatalog(actor) {
  if (!isCatalogRole(actor.role)) throw forbidden('Vai tro cua ban khong co quyen quan ly danh muc thu tuc.');
}

// Danh sach thu tuc cho man quan ly. Can bo Quay chi thay thu tuc thuoc linh vuc quay minh.
async function listManageable(actor) {
  let fieldIds = null;
  if (!isCatalogRole(actor.role)) {
    if (actor.role !== 'OFFICER') throw forbidden('Vai tro cua ban khong co quyen xem danh muc thu tuc.');
    fieldIds = await officerFieldIds(pool, actor.staffId);
  }
  const rows = await serviceRepo.listForManage(pool, fieldIds);
  return rows.map(present);
}

// UC-61: ghi de toan bo danh sach giay to cua 1 thu tuc.
async function updateDocs(serviceId, docsInput, version, actor, reason) {
  const docs = normalizeRequiredDocs(docsInput);

  const result = await withTransaction(async (client) => {
    const service = await serviceRepo.lockById(client, serviceId);
    if (!service) throw notFound();
    await assertCanEditDocs(client, actor, service);
    assertVersion(service, version);

    const updated = await serviceRepo.updateRequiredDocs(client, serviceId, docs);
    await auditRepo.insertLog(client, {
      adminId: actor.staffId, action: 'UPDATE_SERVICE_DOCS', targetType: 'SERVICE', targetId: serviceId,
      reason: reason || 'Cap nhat danh sach giay to cua thu tuc',
      payload: { code: service.code, before: service.required_docs || [], after: docs }
    });
    return { service: { ...updated, field_name: service.field_name, field_code: service.field_code }, code: service.code };
  });

  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { serviceId: Number(serviceId), code: result.code, kind: 'DOCS' });
  return present(result.service);
}

// UC-60 "sua": ten, ten goi tat, SLA va le phi.
async function updateInfo(serviceId, infoInput, version, actor, reason) {
  assertCanManageCatalog(actor);
  const info = normalizeServiceInfo(infoInput);

  const result = await withTransaction(async (client) => {
    const service = await serviceRepo.lockById(client, serviceId);
    if (!service) throw notFound();
    assertVersion(service, version);

    const feeChanged = Number(service.fee_amount) !== info.feeAmount
      || (service.fee_label || null) !== info.feeLabel
      || (service.fee_note || null) !== info.feeNote;
    // Da sua le phi bang tay -> khoa lai de migration updateServiceFees khong ghi de khi khoi dong.
    const feeManual = feeChanged ? 1 : (Number(service.fee_manual) || 0);

    const updated = await serviceRepo.updateInfo(client, serviceId, { ...info, feeManual });
    await auditRepo.insertLog(client, {
      adminId: actor.staffId, action: 'UPDATE_SERVICE', targetType: 'SERVICE', targetId: serviceId,
      reason: reason || (feeChanged ? 'Cap nhat thong tin va le phi thu tuc' : 'Cap nhat thong tin thu tuc'),
      payload: {
        code: service.code,
        before: {
          name: service.name, short_alias: service.short_alias, sla_minutes: service.sla_minutes,
          fee_amount: Number(service.fee_amount), fee_label: service.fee_label || null, fee_note: service.fee_note || null
        },
        after: {
          name: info.name, short_alias: info.shortAlias, sla_minutes: info.slaMinutes,
          fee_amount: info.feeAmount, fee_label: info.feeLabel, fee_note: info.feeNote
        }
      }
    });
    return { service: { ...updated, field_name: service.field_name, field_code: service.field_code }, code: service.code };
  });

  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { serviceId: Number(serviceId), code: result.code, kind: 'INFO' });
  return present(result.service);
}

// UC-60 "an/hien". Hien thu tuc chua co giay to nao -> chan (cai giay to xong moi hien).
async function setActive(serviceId, isActive, version, actor, reason) {
  assertCanManageCatalog(actor);
  const active = !!isActive;

  const result = await withTransaction(async (client) => {
    const service = await serviceRepo.lockById(client, serviceId);
    if (!service) throw notFound();
    assertVersion(service, version);
    if (active && (!Array.isArray(service.required_docs) || service.required_docs.length === 0)) {
      throw new ValidationError('Thu tuc chua co giay to nao. Hay cai giay to truoc khi cho hien tren Kiosk.');
    }

    const updated = await serviceRepo.setActive(client, serviceId, active);
    await auditRepo.insertLog(client, {
      adminId: actor.staffId, action: active ? 'SHOW_SERVICE' : 'HIDE_SERVICE', targetType: 'SERVICE', targetId: serviceId,
      reason: reason || (active ? 'Cho hien thu tuc tren Kiosk' : 'An thu tuc khoi Kiosk'),
      payload: { code: service.code, from: Number(service.is_active), to: active ? 1 : 0 }
    });
    return { service: { ...updated, field_name: service.field_name, field_code: service.field_code }, code: service.code };
  });

  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { serviceId: Number(serviceId), code: result.code, kind: 'VISIBILITY' });
  return present(result.service);
}

// UC-60 "them": thu tuc moi luon o trang thai AN.
async function createService(input, actor) {
  assertCanManageCatalog(actor);
  const data = normalizeNewService(input);

  let created;
  try {
    created = await withTransaction(async (client) => {
      const row = await serviceRepo.insertService(client, data);
      await auditRepo.insertLog(client, {
        adminId: actor.staffId, action: 'CREATE_SERVICE', targetType: 'SERVICE', targetId: row.id,
        reason: 'Them thu tuc moi (mac dinh an, cho cai giay to)',
        payload: { code: data.code, name: data.name, field_id: data.fieldId }
      });
      return row;
    });
  } catch (err) {
    if (err.code === '23505') throw new ValidationError('Ma thu tuc da ton tai.');
    if (err.code === '23503') throw new ValidationError('Linh vuc khong ton tai.');
    throw err;
  }

  wsHub.broadcast(wsHub.EVENTS.SERVICE_DOCS_UPDATED, { serviceId: created.id, code: created.code, kind: 'CREATED' });
  return present(created);
}

// Can bo Quay tai danh sach giay to cua 1 thu tuc (ke ca thu tuc dang an) de chon giay thieu khi
// Yeu cau Bo sung (UC-21) - khong di qua Kiosk cong khai vi Kiosk khong tra thu tuc da an.
async function getDocsForStaff(serviceId, actor) {
  const service = await serviceRepo.findServiceById(pool, serviceId);
  if (!service) throw notFound();
  if (actor.role === 'OFFICER') {
    // Officer xem duoc giay to cua thu tuc thuoc linh vuc quay minh (du de xu ly ve dang phuc vu).
    await assertCanEditDocs(pool, actor, service);
  }
  return {
    service: { id: service.id, code: service.code, name: service.name, is_active: Number(service.is_active) },
    docs: service.required_docs || []
  };
}

// Dung chung cho adminRoutes va counterRoutes: loi nghiep vu -> 400/403/404/409, loi bat ngo -> 500
// (khong lo noi dung loi he thong ra ngoai).
function respondError(res, err) {
  if (err instanceof CatalogError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
  console.error('[serviceCatalog]', err);
  return res.status(500).json({ error: 'Loi he thong noi bo.' });
}

module.exports = {
  respondError, CatalogError, CATALOG_ROLES,
  listManageable, updateDocs, updateInfo, setActive, createService, getDocsForStaff
};
