const env = import.meta.env || {};
const digits = (v) => String(v || '').replace(/[^\d+]/g, '');

export const CONTACT_PHONE = digits(env.VITE_CONTACT_PHONE) || '+918299251267';
export const WHATSAPP_NUMBER = String(env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '') || '918299251267';
export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL || 'career@surehire.in';
export const WHATSAPP_MESSAGE = env.VITE_WHATSAPP_MESSAGE || 'Hi SureHire, I would like some help.';

export const telHref = CONTACT_PHONE ? `tel:${CONTACT_PHONE}` : '';
export const mailHref = `mailto:${CONTACT_EMAIL}`;
export const waHref = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
  : '';

export const fillTemplate = (text) => text
  .replace(/\{email\}/g, CONTACT_EMAIL)
  .replace(/\{phone\}/g, CONTACT_PHONE)
  .replace(/\{phoneText\}/g, CONTACT_PHONE ? `, by phone at ${formatIndianNumber(CONTACT_PHONE)}` : '')
  .replace(/\{waText\}/g, WHATSAPP_NUMBER ? `, or on WhatsApp at ${formatIndianNumber(WHATSAPP_NUMBER)}` : '')
  .replace(/\{wa\}/g, formatIndianNumber(WHATSAPP_NUMBER));

export const waHrefPlain = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : '';
export const formatIndianNumber = (n) => {
  const d = String(n || '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : (n || '');
};
export const PHONE_DISPLAY = formatIndianNumber(CONTACT_PHONE);
export const WHATSAPP_DISPLAY = formatIndianNumber(WHATSAPP_NUMBER);
