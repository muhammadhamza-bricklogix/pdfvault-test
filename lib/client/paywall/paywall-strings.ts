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

  // Pay step
  pay: {
    back: string;
    totalDueToday: string;
    expressCheckout: string;
    payWithCard: string;
    // Access block header
    sevenDayAccess: string;
    annualAccess: string;
    // Feature list on pay step
    unlimitedDownloads: string;
    unlimitedEdits: string;
    convertAnyFormat: string;
    passwordProtect: string;
    // Legal small-print
    // Two variants — monthly (trial → recurring) vs annual.
    // `<0>` and `<1>` mark the position of the "Subscription" and
    // "Refund" links so PayStep can render them via segments.
    disclaimerMonthly: (a: {
      todayAmount: string;
      renewAmount: string;
    }) => { intro: string; policySeparator: string; policyOutro: string };
    disclaimerAnnual: (a: {
      todayAmount: string;
    }) => { intro: string; policySeparator: string; policyOutro: string };
    subscriptionLink: string;
    refundLink: string;
    // Right column
    yourDocumentReady: string;
    cardSecurityNote: string;
    // Decline state
    cardDeclinedHeading: string;
    cardDeclinedBody: string;
    tryAnotherCard: string;
    // Loading state
    preparing: string;
  };
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
  pay: {
    back: "Back",
    totalDueToday: "Total due today",
    expressCheckout: "Express checkout",
    payWithCard: "Pay with card",
    sevenDayAccess: "7-Day Access",
    annualAccess: "Annual Access",
    unlimitedDownloads: "Unlimited downloads",
    unlimitedEdits: "Unlimited edits",
    convertAnyFormat: "Convert to any format",
    passwordProtect: "Password-protect your documents",
    disclaimerMonthly: (a) => ({
      intro: `By continuing you agree to be charged ${a.todayAmount} today for a 7-day trial, then ${a.renewAmount} per month unless cancelled. See our `,
      policySeparator: " & ",
      policyOutro: " policies.",
    }),
    disclaimerAnnual: (a) => ({
      intro: `By continuing you agree to be charged ${a.todayAmount} every 365 days unless cancelled. See our `,
      policySeparator: " & ",
      policyOutro: " policies.",
    }),
    subscriptionLink: "Subscription",
    refundLink: "Refund",
    yourDocumentReady: "Your document is ready!",
    cardSecurityNote:
      "Card details never touch our servers. Payments run through a PCI-compliant partner.",
    cardDeclinedHeading: "Your card was declined and hasn't been charged.",
    cardDeclinedBody:
      "Try another card or contact your bank. You can re-enter details below.",
    tryAnotherCard: "Try another card",
    preparing: "Preparing…",
  },
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
  pay: {
    back: "Zurück",
    totalDueToday: "Heute fällig",
    expressCheckout: "Schnellkasse",
    payWithCard: "Mit Karte zahlen",
    sevenDayAccess: "7-Tage-Zugang",
    annualAccess: "Jahreszugang",
    unlimitedDownloads: "Unbegrenzte Downloads",
    unlimitedEdits: "Unbegrenzte Bearbeitungen",
    convertAnyFormat: "In beliebiges Format konvertieren",
    passwordProtect: "Ihre Dokumente mit Passwort schützen",
    disclaimerMonthly: (a) => ({
      intro: `Mit dem Fortfahren stimmen Sie zu, heute ${a.todayAmount} für eine 7-tägige Testphase in Rechnung gestellt zu bekommen, danach ${a.renewAmount} pro Monat, wenn nicht gekündigt. Siehe unsere `,
      policySeparator: " & ",
      policyOutro: "-Bestimmungen.",
    }),
    disclaimerAnnual: (a) => ({
      intro: `Mit dem Fortfahren stimmen Sie zu, alle 365 Tage ${a.todayAmount} in Rechnung gestellt zu bekommen, wenn nicht gekündigt. Siehe unsere `,
      policySeparator: " & ",
      policyOutro: "-Bestimmungen.",
    }),
    subscriptionLink: "Abonnement",
    refundLink: "Erstattung",
    yourDocumentReady: "Ihr Dokument ist fertig!",
    cardSecurityNote:
      "Kartendaten erreichen unsere Server nie. Zahlungen werden über einen PCI-konformen Partner abgewickelt.",
    cardDeclinedHeading:
      "Ihre Karte wurde abgelehnt und nicht belastet.",
    cardDeclinedBody:
      "Versuchen Sie eine andere Karte oder wenden Sie sich an Ihre Bank. Sie können die Daten unten erneut eingeben.",
    tryAnotherCard: "Andere Karte versuchen",
    preparing: "Wird vorbereitet…",
  },
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
  pay: {
    back: "Atrás",
    totalDueToday: "Total a pagar hoy",
    expressCheckout: "Pago exprés",
    payWithCard: "Pagar con tarjeta",
    sevenDayAccess: "Acceso de 7 días",
    annualAccess: "Acceso anual",
    unlimitedDownloads: "Descargas ilimitadas",
    unlimitedEdits: "Ediciones ilimitadas",
    convertAnyFormat: "Convertir a cualquier formato",
    passwordProtect: "Protege tus documentos con contraseña",
    disclaimerMonthly: (a) => ({
      intro: `Al continuar aceptas que se te cobrarán ${a.todayAmount} hoy por una prueba de 7 días, y después ${a.renewAmount} al mes salvo que canceles. Consulta nuestras políticas de `,
      policySeparator: " y ",
      policyOutro: ".",
    }),
    disclaimerAnnual: (a) => ({
      intro: `Al continuar aceptas que se te cobrarán ${a.todayAmount} cada 365 días salvo que canceles. Consulta nuestras políticas de `,
      policySeparator: " y ",
      policyOutro: ".",
    }),
    subscriptionLink: "Suscripción",
    refundLink: "Reembolso",
    yourDocumentReady: "¡Tu documento está listo!",
    cardSecurityNote:
      "Los datos de la tarjeta nunca pasan por nuestros servidores. Los pagos se procesan a través de un socio con cumplimiento PCI.",
    cardDeclinedHeading: "Tu tarjeta fue rechazada y no se ha cobrado.",
    cardDeclinedBody:
      "Prueba con otra tarjeta o contacta con tu banco. Puedes volver a introducir los datos abajo.",
    tryAnotherCard: "Probar con otra tarjeta",
    preparing: "Preparando…",
  },
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
  pay: {
    back: "Retour",
    totalDueToday: "Total à payer aujourd'hui",
    expressCheckout: "Paiement express",
    payWithCard: "Payer par carte",
    sevenDayAccess: "Accès 7 jours",
    annualAccess: "Accès annuel",
    unlimitedDownloads: "Téléchargements illimités",
    unlimitedEdits: "Modifications illimitées",
    convertAnyFormat: "Convertir vers n'importe quel format",
    passwordProtect: "Protéger vos documents par mot de passe",
    disclaimerMonthly: (a) => ({
      intro: `En continuant, vous acceptez d'être facturé ${a.todayAmount} aujourd'hui pour un essai de 7 jours, puis ${a.renewAmount} par mois sauf annulation. Consultez nos politiques `,
      policySeparator: " et ",
      policyOutro: ".",
    }),
    disclaimerAnnual: (a) => ({
      intro: `En continuant, vous acceptez d'être facturé ${a.todayAmount} tous les 365 jours sauf annulation. Consultez nos politiques `,
      policySeparator: " et ",
      policyOutro: ".",
    }),
    subscriptionLink: "d'abonnement",
    refundLink: "de remboursement",
    yourDocumentReady: "Votre document est prêt !",
    cardSecurityNote:
      "Les données de la carte n'atteignent jamais nos serveurs. Les paiements passent par un partenaire conforme PCI.",
    cardDeclinedHeading: "Votre carte a été refusée et n'a pas été débitée.",
    cardDeclinedBody:
      "Essayez une autre carte ou contactez votre banque. Vous pouvez saisir à nouveau les détails ci-dessous.",
    tryAnotherCard: "Essayer une autre carte",
    preparing: "Préparation…",
  },
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
  pay: {
    back: "Voltar",
    totalDueToday: "Total a pagar hoje",
    expressCheckout: "Checkout expresso",
    payWithCard: "Pagar com cartão",
    sevenDayAccess: "Acesso de 7 dias",
    annualAccess: "Acesso anual",
    unlimitedDownloads: "Downloads ilimitados",
    unlimitedEdits: "Edições ilimitadas",
    convertAnyFormat: "Converter para qualquer formato",
    passwordProtect: "Proteja seus documentos com senha",
    disclaimerMonthly: (a) => ({
      intro: `Ao continuar você concorda em ser cobrado ${a.todayAmount} hoje por um teste de 7 dias, depois ${a.renewAmount} por mês salvo cancelamento. Veja nossas políticas de `,
      policySeparator: " e ",
      policyOutro: ".",
    }),
    disclaimerAnnual: (a) => ({
      intro: `Ao continuar você concorda em ser cobrado ${a.todayAmount} a cada 365 dias salvo cancelamento. Veja nossas políticas de `,
      policySeparator: " e ",
      policyOutro: ".",
    }),
    subscriptionLink: "Assinatura",
    refundLink: "Reembolso",
    yourDocumentReady: "Seu documento está pronto!",
    cardSecurityNote:
      "Os dados do cartão nunca chegam aos nossos servidores. Pagamentos são processados por um parceiro compatível com PCI.",
    cardDeclinedHeading: "Seu cartão foi recusado e não foi cobrado.",
    cardDeclinedBody:
      "Tente outro cartão ou entre em contato com seu banco. Você pode inserir os dados novamente abaixo.",
    tryAnotherCard: "Tentar outro cartão",
    preparing: "Preparando…",
  },
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
  pay: {
    back: "رجوع",
    totalDueToday: "الإجمالي المستحق اليوم",
    expressCheckout: "الدفع السريع",
    payWithCard: "الدفع بالبطاقة",
    sevenDayAccess: "الوصول لمدة 7 أيام",
    annualAccess: "الوصول السنوي",
    unlimitedDownloads: "تنزيلات غير محدودة",
    unlimitedEdits: "تعديلات غير محدودة",
    convertAnyFormat: "التحويل إلى أي صيغة",
    passwordProtect: "حماية مستنداتك بكلمة مرور",
    disclaimerMonthly: (a) => ({
      intro: `بالمتابعة أنت توافق على أن يتم خصم ${a.todayAmount} اليوم مقابل تجربة لمدة 7 أيام، ثم ${a.renewAmount} شهريًا ما لم يتم الإلغاء. راجع سياسات `,
      policySeparator: " و ",
      policyOutro: " الخاصة بنا.",
    }),
    disclaimerAnnual: (a) => ({
      intro: `بالمتابعة أنت توافق على أن يتم خصم ${a.todayAmount} كل 365 يومًا ما لم يتم الإلغاء. راجع سياسات `,
      policySeparator: " و ",
      policyOutro: " الخاصة بنا.",
    }),
    subscriptionLink: "الاشتراك",
    refundLink: "الاسترداد",
    yourDocumentReady: "مستندك جاهز!",
    cardSecurityNote:
      "بيانات البطاقة لا تصل إلى خوادمنا أبدًا. تتم معالجة المدفوعات عبر شريك متوافق مع PCI.",
    cardDeclinedHeading: "تم رفض بطاقتك ولم يتم خصم أي مبلغ.",
    cardDeclinedBody:
      "جرب بطاقة أخرى أو تواصل مع البنك. يمكنك إعادة إدخال البيانات أدناه.",
    tryAnotherCard: "جرب بطاقة أخرى",
    preparing: "جارٍ التحضير…",
  },
};

const table: Record<string, PaywallStrings> = { en, de, es, fr, pt, ar };

export function getPaywallStrings(locale: Locale | string): PaywallStrings {
  return table[locale] ?? en;
}
