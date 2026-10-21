// =============================== TAB: GIAY TO THU TUC ===============================
// Tach rieng khoi admin.js (xem ghi chu trong admin-monitor.js). Bo soan dung chung o
// js/serviceDocsEditor.js; tab nay danh cho SUPER_ADMIN/MANAGER/SUPERVISOR (quyen SERVICE_DOCS).
let serviceDocsEditorInstance = null;
function loadServiceDocsTab() {
  if (!serviceDocsEditorInstance) {
    serviceDocsEditorInstance = ServiceDocsEditor.mount(document.getElementById('serviceDocsEditor'), {
      listUrl: '/api/admin/services',
      saveUrl: (id) => `/api/admin/services/${id}/required-docs`
    });
  } else if (!serviceDocsEditorInstance.isDirty()) {
    serviceDocsEditorInstance.reload();
  }
}
function onServiceDocsUpdated(serviceId, updatedAt) {
  if (serviceDocsEditorInstance) serviceDocsEditorInstance.onRemoteUpdate(serviceId, updatedAt);
}
