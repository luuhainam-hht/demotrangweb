// Tai thu vien sinh QR (qrcodejs 1.0.0, MIT) tu public/vendor/ - nang cap 10/2026: KHONG con phu thuoc cdnjs,
// nen may Kiosk chay Docker offline tai Trung tam van tao duoc ma QR. Dung chung cho cac trang moi.
window.QrLoader = {
  _promise: null,
  load() {
    if (window.QRCode) return Promise.resolve();
    if (!this._promise) {
      this._promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/qrcode.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Khong tai duoc thu vien QR'));
        document.head.appendChild(script);
      });
    }
    return this._promise;
  }
};
