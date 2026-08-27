// Arabic (العربية) message catalog (GAP-25). Typed as `Messages`, so tsc fails
// the build if any key present in English is missing here. Arabic is written
// right-to-left; the interface mirrors automatically via the `dir` attribute.

import type { Messages } from './en';

export const ar: Messages = {
  app: {
    name: 'شيورا على أيثلريد',
    tagline: 'منصة الذكاء الاصطناعي لصحة المرأة',
  },
  common: {
    save: 'حفظ',
    cancel: 'إلغاء',
    close: 'إغلاق',
    confirm: 'تأكيد',
    delete: 'حذف',
    loading: 'جارٍ التحميل…',
    retry: 'إعادة المحاولة',
    search: 'بحث',
    connectWallet: 'ربط المحفظة',
    disconnect: 'قطع الاتصال',
  },
  language: {
    title: 'اللغة والمنطقة',
    description: 'اختر لغة العرض. النصوص من اليمين إلى اليسار تعكس الواجهة بالكامل.',
    label: 'اللغة',
    current: 'اللغة الحالية: {name}',
    rtlNote: 'تُعرض هذه اللغة من اليمين إلى اليسار.',
    ltrNote: 'تُعرض هذه اللغة من اليسار إلى اليمين.',
  },
  nav: {
    dashboard: 'لوحة التحكم',
    records: 'السجلات الصحية',
    chat: 'محادثة الذكاء الاصطناعي الصحية',
    insights: 'رؤى الذكاء الاصطناعي',
    vault: 'خزنة البيانات',
    access: 'التحكم في الوصول',
    compliance: 'مركز الامتثال',
    settings: 'الإعدادات',
  },
  records: {
    count: {
      one: 'سجل واحد',
      other: '{count} سجلات',
    },
  },
};
