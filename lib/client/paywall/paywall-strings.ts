/**
 * Local translations for the paywall modal — deliberately NOT going
 * through Weglot.
 *
 * Weglot mutates React's text nodes on every plan-card click, and
 * React's next `commitDeletion` throws `NotFoundError: Failed to
 * execute 'removeChild' on 'Node'` because the fibers still point at
 * the pre-mutation nodes. `<Modal.Dialog>` carries `translate="no"` +
 * `notranslate` + `wg-notranslate` markers plus the excludeBlocks
 * selector configured in `WeglotBoot`, so Weglot skips this subtree
 * entirely and this dictionary provides the localised strings the
 * user actually sees on `/de/`, `/es/`, `/fr/`, `/pt/`, `/ar/`.
 *
 * English (`en`) is the source and applies to the default (no-prefix)
 * routes. Any locale not listed falls back to English.
 *
 * Keep this file conservative — only strings that render on the plan
 * selector step (the surface that reproduced the removeChild crash).
 * The pay step delegates to Solidgate's iframe (Solidgate handles its
 * own i18n), and the success step is short enough that Weglot's
 * mutation of it is safe (no re-render after mount).
 */

import type { Locale } from "@/lib/shared/constants/locale-map";

export type PaywallStrings = {
  // Header row
  ready: {
    pdf: string;
    jpg: string;
    png: string;
    word: string;
    excel: string;
    powerpoint: string;
    txt: string;
  };
  headerSubtitle: string;
  // Preview column
  documentReady: string;
  // Plan cards
  mostPopular: string;
  sevenDayTrial: string;
  annualPlan: string;
  perMonth: string;
  billedAsYear: (fullPrice: string) => string;
  // Feature list
  features: {
    unlimitedEdits: string;
    unlimitedDownloads: string;
    multiFormatConversion: string;
    editTextImages: string;
    organizePages: string;
    protectPassword: string;
  };
  // Accepted cards row
  weAccept: string;
  // Continue CTA
  continueCta: string;
  continuePreparing: string;
  // Disclaimer footer — two variants
  disclaimerMonthly: (args: {
    todayAmount: string;
    monthlyAmount: string;
    settingsHref: string;
    termsHref: string;
    billingCurrency: string;
  }) => string;
  disclaimerAnnual: (args: {
    todayAmount: string;
    annualAmount: string;
    settingsHref: string;
    termsHref: string;
    billingCurrency: string;
  }) => string;
};

const en: PaywallStrings = {
  ready: {
    pdf: "Your PDF is ready.",
    jpg: "Your JPG is ready.",
    png: "Your PNG is ready.",
    word: "Your Word document is ready.",
    excel: "Your Excel document is ready.",
    powerpoint: "Your PowerPoint presentation is ready.",
    txt: "Your Text document is ready.",
  },
  headerSubtitle: "Cancel anytime · Secure checkout · Instant access",
  documentReady: "Your document is ready to download",
  mostPopular: "🚀 Most popular",
  sevenDayTrial: "7-day trial",
  annualPlan: "Annual Plan",
  perMonth: "/ month",
  billedAsYear: (p) => `Billed as ${p} / year`,
  features: {
    unlimitedEdits: "Unlimited edits",
    unlimitedDownloads: "Unlimited downloads",
    multiFormatConversion: "Multi-format conversion",
    editTextImages: "Edit text and images in PDF files",
    organizePages: "Organize and reorder PDF pages",
    protectPassword: "Protect PDF with password",
  },
  weAccept: "We accept",
  continueCta: "Continue",
  continuePreparing: "Preparing…",
  disclaimerMonthly: (a) =>
    `You are enrolling in a monthly subscription to pdfvault.ai. You'll be charged ${a.todayAmount} today for a 7-day trial, then ${a.monthlyAmount} per month until you cancel. Payments will be charged from the card you specified below. To cancel, visit your account settings, see our subscription terms, or email support@pdfvault.ai. Billing is in ${a.billingCurrency}. See our terms and conditions.`,
  disclaimerAnnual: (a) =>
    `You are enrolling in an annual subscription to pdfvault.ai. You'll be charged ${a.todayAmount} today, then ${a.annualAmount} per year until you cancel. Payments will be charged from the card you specified below. To cancel, visit your account settings, see our subscription terms, or email support@pdfvault.ai. Billing is in ${a.billingCurrency}. See our terms and conditions.`,
};

const de: PaywallStrings = {
  ready: {
    pdf: "Ihre PDF-Datei ist fertig.",
    jpg: "Ihre JPG-Datei ist fertig.",
    png: "Ihre PNG-Datei ist fertig.",
    word: "Ihr Word-Dokument ist fertig.",
    excel: "Ihr Excel-Dokument ist fertig.",
    powerpoint: "Ihre PowerPoint-Präsentation ist fertig.",
    txt: "Ihr Textdokument ist fertig.",
  },
  headerSubtitle: "Jederzeit kündbar · Sichere Bezahlung · Sofortiger Zugriff",
  documentReady: "Ihr Dokument steht zum Herunterladen bereit",
  mostPopular: "🚀 Am beliebtesten",
  sevenDayTrial: "7-tägige Testversion",
  annualPlan: "Jahresplan",
  perMonth: "/ Monat",
  billedAsYear: (p) => `Abrechnung als ${p} / Jahr`,
  features: {
    unlimitedEdits: "Unbegrenzte Bearbeitungen",
    unlimitedDownloads: "Unbegrenzte Downloads",
    multiFormatConversion: "Konvertierung in verschiedene Formate",
    editTextImages: "Text und Bilder in PDF-Dateien bearbeiten",
    organizePages: "PDF-Seiten organisieren und neu anordnen",
    protectPassword: "PDF mit Passwort schützen",
  },
  weAccept: "Wir akzeptieren",
  continueCta: "Weiter",
  continuePreparing: "Wird vorbereitet…",
  disclaimerMonthly: (a) =>
    `Sie melden sich für ein monatliches Abonnement bei pdfvault.ai an. Heute werden Ihnen ${a.todayAmount} für eine 7-tägige Testphase in Rechnung gestellt, danach ${a.monthlyAmount} pro Monat, bis Sie kündigen. Die Zahlungen werden von der unten angegebenen Karte abgebucht. Um zu kündigen, rufen Sie Ihre Kontoeinstellungen auf, lesen Sie unsere Abonnementbedingungen oder senden Sie eine E-Mail an support@pdfvault.ai. Die Abrechnung erfolgt in ${a.billingCurrency}. Weitere Informationen finden Sie in unseren Allgemeinen Geschäftsbedingungen.`,
  disclaimerAnnual: (a) =>
    `Sie melden sich für ein Jahresabonnement bei pdfvault.ai an. Heute werden Ihnen ${a.todayAmount} in Rechnung gestellt, danach ${a.annualAmount} pro Jahr, bis Sie kündigen. Die Zahlungen werden von der unten angegebenen Karte abgebucht. Um zu kündigen, rufen Sie Ihre Kontoeinstellungen auf, lesen Sie unsere Abonnementbedingungen oder senden Sie eine E-Mail an support@pdfvault.ai. Die Abrechnung erfolgt in ${a.billingCurrency}. Weitere Informationen finden Sie in unseren Allgemeinen Geschäftsbedingungen.`,
};

const es: PaywallStrings = {
  ready: {
    pdf: "Tu PDF está listo.",
    jpg: "Tu JPG está listo.",
    png: "Tu PNG está listo.",
    word: "Tu documento de Word está listo.",
    excel: "Tu documento de Excel está listo.",
    powerpoint: "Tu presentación de PowerPoint está lista.",
    txt: "Tu documento de texto está listo.",
  },
  headerSubtitle:
    "Cancela cuando quieras · Pago seguro · Acceso instantáneo",
  documentReady: "Tu documento está listo para descargar",
  mostPopular: "🚀 Más popular",
  sevenDayTrial: "Prueba de 7 días",
  annualPlan: "Plan anual",
  perMonth: "/ mes",
  billedAsYear: (p) => `Facturado como ${p} / año`,
  features: {
    unlimitedEdits: "Ediciones ilimitadas",
    unlimitedDownloads: "Descargas ilimitadas",
    multiFormatConversion: "Conversión multiformato",
    editTextImages: "Editar texto e imágenes en archivos PDF",
    organizePages: "Organizar y reordenar páginas PDF",
    protectPassword: "Proteger PDF con contraseña",
  },
  weAccept: "Aceptamos",
  continueCta: "Continuar",
  continuePreparing: "Preparando…",
  disclaimerMonthly: (a) =>
    `Estás contratando una suscripción mensual a pdfvault.ai. Hoy se te cobrarán ${a.todayAmount} por una prueba de 7 días y, a continuación, ${a.monthlyAmount} al mes hasta que canceles. Los pagos se cargarán en la tarjeta indicada. Para cancelar, visita la configuración de tu cuenta, consulta los términos de la suscripción o escribe a support@pdfvault.ai. La facturación se realiza en ${a.billingCurrency}. Más información en nuestros términos y condiciones.`,
  disclaimerAnnual: (a) =>
    `Estás contratando una suscripción anual a pdfvault.ai. Hoy se te cobrarán ${a.todayAmount} y, a continuación, ${a.annualAmount} al año hasta que canceles. Los pagos se cargarán en la tarjeta indicada. Para cancelar, visita la configuración de tu cuenta, consulta los términos de la suscripción o escribe a support@pdfvault.ai. La facturación se realiza en ${a.billingCurrency}. Más información en nuestros términos y condiciones.`,
};

const fr: PaywallStrings = {
  ready: {
    pdf: "Votre PDF est prêt.",
    jpg: "Votre JPG est prêt.",
    png: "Votre PNG est prêt.",
    word: "Votre document Word est prêt.",
    excel: "Votre document Excel est prêt.",
    powerpoint: "Votre présentation PowerPoint est prête.",
    txt: "Votre document texte est prêt.",
  },
  headerSubtitle:
    "Annulez à tout moment · Paiement sécurisé · Accès instantané",
  documentReady: "Votre document est prêt à être téléchargé",
  mostPopular: "🚀 Le plus populaire",
  sevenDayTrial: "Essai de 7 jours",
  annualPlan: "Plan annuel",
  perMonth: "/ mois",
  billedAsYear: (p) => `Facturé ${p} / an`,
  features: {
    unlimitedEdits: "Modifications illimitées",
    unlimitedDownloads: "Téléchargements illimités",
    multiFormatConversion: "Conversion multi-format",
    editTextImages: "Modifier le texte et les images des PDF",
    organizePages: "Organiser et réordonner les pages PDF",
    protectPassword: "Protéger un PDF par mot de passe",
  },
  weAccept: "Nous acceptons",
  continueCta: "Continuer",
  continuePreparing: "Préparation…",
  disclaimerMonthly: (a) =>
    `Vous vous abonnez à un abonnement mensuel à pdfvault.ai. Vous serez facturé ${a.todayAmount} aujourd'hui pour un essai de 7 jours, puis ${a.monthlyAmount} par mois jusqu'à ce que vous annuliez. Les paiements seront prélevés sur la carte indiquée ci-dessous. Pour annuler, consultez les paramètres de votre compte, nos conditions d'abonnement ou envoyez un e-mail à support@pdfvault.ai. La facturation est en ${a.billingCurrency}. Consultez nos conditions générales.`,
  disclaimerAnnual: (a) =>
    `Vous vous abonnez à un abonnement annuel à pdfvault.ai. Vous serez facturé ${a.todayAmount} aujourd'hui, puis ${a.annualAmount} par an jusqu'à ce que vous annuliez. Les paiements seront prélevés sur la carte indiquée ci-dessous. Pour annuler, consultez les paramètres de votre compte, nos conditions d'abonnement ou envoyez un e-mail à support@pdfvault.ai. La facturation est en ${a.billingCurrency}. Consultez nos conditions générales.`,
};

const pt: PaywallStrings = {
  ready: {
    pdf: "Seu PDF está pronto.",
    jpg: "Seu JPG está pronto.",
    png: "Seu PNG está pronto.",
    word: "Seu documento do Word está pronto.",
    excel: "Seu documento do Excel está pronto.",
    powerpoint: "Sua apresentação do PowerPoint está pronta.",
    txt: "Seu documento de texto está pronto.",
  },
  headerSubtitle:
    "Cancele a qualquer momento · Checkout seguro · Acesso instantâneo",
  documentReady: "Seu documento está pronto para download",
  mostPopular: "🚀 Mais popular",
  sevenDayTrial: "Teste de 7 dias",
  annualPlan: "Plano anual",
  perMonth: "/ mês",
  billedAsYear: (p) => `Cobrado como ${p} / ano`,
  features: {
    unlimitedEdits: "Edições ilimitadas",
    unlimitedDownloads: "Downloads ilimitados",
    multiFormatConversion: "Conversão em múltiplos formatos",
    editTextImages: "Editar texto e imagens em arquivos PDF",
    organizePages: "Organizar e reordenar páginas do PDF",
    protectPassword: "Proteger PDF com senha",
  },
  weAccept: "Aceitamos",
  continueCta: "Continuar",
  continuePreparing: "Preparando…",
  disclaimerMonthly: (a) =>
    `Você está assinando uma assinatura mensal do pdfvault.ai. Hoje você será cobrado ${a.todayAmount} por um teste de 7 dias, depois ${a.monthlyAmount} por mês até cancelar. Os pagamentos serão cobrados no cartão informado abaixo. Para cancelar, acesse as configurações da sua conta, veja nossos termos de assinatura ou envie um e-mail para support@pdfvault.ai. O faturamento é em ${a.billingCurrency}. Consulte nossos termos e condições.`,
  disclaimerAnnual: (a) =>
    `Você está assinando uma assinatura anual do pdfvault.ai. Hoje você será cobrado ${a.todayAmount}, depois ${a.annualAmount} por ano até cancelar. Os pagamentos serão cobrados no cartão informado abaixo. Para cancelar, acesse as configurações da sua conta, veja nossos termos de assinatura ou envie um e-mail para support@pdfvault.ai. O faturamento é em ${a.billingCurrency}. Consulte nossos termos e condições.`,
};

const ar: PaywallStrings = {
  ready: {
    pdf: "ملف PDF جاهز.",
    jpg: "ملف JPG جاهز.",
    png: "ملف PNG جاهز.",
    word: "مستند Word جاهز.",
    excel: "مستند Excel جاهز.",
    powerpoint: "عرض PowerPoint التقديمي جاهز.",
    txt: "المستند النصي جاهز.",
  },
  headerSubtitle: "إلغاء في أي وقت · دفع آمن · وصول فوري",
  documentReady: "مستندك جاهز للتنزيل",
  mostPopular: "🚀 الأكثر شعبية",
  sevenDayTrial: "تجربة 7 أيام",
  annualPlan: "الخطة السنوية",
  perMonth: "/ شهر",
  billedAsYear: (p) => `تُفوتر بمبلغ ${p} / سنة`,
  features: {
    unlimitedEdits: "تعديلات غير محدودة",
    unlimitedDownloads: "تنزيلات غير محدودة",
    multiFormatConversion: "التحويل بصيغ متعددة",
    editTextImages: "تحرير النصوص والصور في ملفات PDF",
    organizePages: "تنظيم وإعادة ترتيب صفحات PDF",
    protectPassword: "حماية PDF بكلمة مرور",
  },
  weAccept: "نقبل",
  continueCta: "متابعة",
  continuePreparing: "جارٍ التحضير…",
  disclaimerMonthly: (a) =>
    `أنت تشترك في اشتراك شهري في pdfvault.ai. سيتم فرض ${a.todayAmount} اليوم مقابل تجربة لمدة 7 أيام، ثم ${a.monthlyAmount} شهريًا حتى تلغي الاشتراك. سيتم خصم الدفعات من البطاقة المحددة أدناه. للإلغاء، انتقل إلى إعدادات حسابك، أو راجع شروط الاشتراك، أو راسل support@pdfvault.ai. الفوترة بعملة ${a.billingCurrency}. راجع الشروط والأحكام.`,
  disclaimerAnnual: (a) =>
    `أنت تشترك في اشتراك سنوي في pdfvault.ai. سيتم فرض ${a.todayAmount} اليوم، ثم ${a.annualAmount} سنويًا حتى تلغي الاشتراك. سيتم خصم الدفعات من البطاقة المحددة أدناه. للإلغاء، انتقل إلى إعدادات حسابك، أو راجع شروط الاشتراك، أو راسل support@pdfvault.ai. الفوترة بعملة ${a.billingCurrency}. راجع الشروط والأحكام.`,
};

const table: Record<string, PaywallStrings> = { en, de, es, fr, pt, ar };

export function getPaywallStrings(locale: Locale | string): PaywallStrings {
  return table[locale] ?? en;
}
