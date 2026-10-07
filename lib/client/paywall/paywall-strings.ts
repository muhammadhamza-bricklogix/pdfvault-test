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

// A single bullet in a plan card's feature list. `included: false`
// renders as a struck-through/greyed-out row with a ✕ mark so the
// Limited Access card can display features it deliberately excludes
// as a decoy contrast against Full Access.
export type PaywallFeature = { text: string; included?: boolean };

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
  limitedPlan: string;
  fullAccessPlan: string;
  annualPlan: string;
  perMonth: string;
  billedAsYear: (fullPrice: string) => string;
  // Feature lists — Limited has crossed-out rows, Full Access is used
  // for both the Full Access and Annual cards (Annual mirrors Full).
  planFeatures: {
    limited: PaywallFeature[];
    fullAccess: PaywallFeature[];
  };
  // Accepted cards row
  weAccept: string;
  // Continue CTA
  continueCta: string;
  continuePreparing: string;
  // Disclaimer footer — two variants. Monthly copy also covers the
  // Limited Access plan (both are 7-day trial → monthly) since the
  // template already reads the recurring amount from `monthlyAmount`.
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
    disclaimerMonthly: (a: { todayAmount: string; renewAmount: string }) => {
      intro: string;
      policySeparator: string;
      policyOutro: string;
    };
    disclaimerAnnual: (a: { todayAmount: string }) => {
      intro: string;
      policySeparator: string;
      policyOutro: string;
    };
    subscriptionLink: string;
    refundLink: string;
    // Right column
    yourDocumentReady: string;
    cardSecurityNote: string;
    // Decline state
    cardDeclinedHeading: string;
    cardDeclinedBody: string;
    tryAnotherCard: string;
    // Reconcile-on-widget-fail overlay (QA 2026-10-07): Solidgate's
    // widget sometimes paints "Payment declined" even when its own
    // server approved the auth. While we re-query the backend to find
    // the real outcome we show this spinner instead of the misleading
    // widget error.
    verifyingPaymentTitle: string;
    verifyingPaymentBody: string;
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
  limitedPlan: "7-Day Limited Access",
  fullAccessPlan: "7-Day Full Access",
  annualPlan: "Annual Plan",
  perMonth: "/ month",
  billedAsYear: (p) => `Billed as ${p} / year`,
  planFeatures: {
    limited: [
      { text: "Unlimited edits" },
      { text: "Unlimited downloads" },
      { text: "Multi-format conversion (PDF to Word, JPG, Excel, etc.)" },
      { text: "No installation required" },
      { text: "Edit text and images in PDF files" },
      { text: "Organize and reorder PDF pages", included: false },
      {
        text: "Pro password protection & external link sharing",
        included: false,
      },
      {
        text: "High-speed engine (Up to 2x faster processing)",
        included: false,
      },
    ],
    fullAccess: [
      { text: "Unlimited edits & downloads" },
      { text: "Multi-format conversion" },
      { text: "No installation required" },
      { text: "Edit text, images, annotations, and shapes" },
      { text: "Organize, merge, split, and reorder PDF pages" },
      { text: "Pro password protection & secure external link sharing" },
      { text: "Up to 2x faster processing & unlimited compressions" },
    ],
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
    verifyingPaymentTitle: "Verifying your payment…",
    verifyingPaymentBody:
      "This usually takes a few seconds. Please don't close this window.",
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
  limitedPlan: "7-Tage Eingeschränkter Zugriff",
  fullAccessPlan: "7-Tage Vollzugriff",
  annualPlan: "Jahresplan",
  perMonth: "/ Monat",
  billedAsYear: (p) => `Abrechnung als ${p} / Jahr`,
  planFeatures: {
    limited: [
      { text: "Unbegrenzte Bearbeitungen" },
      { text: "Unbegrenzte Downloads" },
      {
        text: "Konvertierung in verschiedene Formate (PDF zu Word, JPG, Excel usw.)",
      },
      { text: "Keine Installation erforderlich" },
      { text: "Text und Bilder in PDF-Dateien bearbeiten" },
      { text: "PDF-Seiten organisieren und neu anordnen", included: false },
      { text: "Pro-Passwortschutz & externe Link-Freigabe", included: false },
      {
        text: "Hochgeschwindigkeits-Engine (bis zu 2× schnellere Verarbeitung)",
        included: false,
      },
    ],
    fullAccess: [
      { text: "Unbegrenzte Bearbeitungen & Downloads" },
      { text: "Konvertierung in verschiedene Formate" },
      { text: "Keine Installation erforderlich" },
      { text: "Text, Bilder, Anmerkungen und Formen bearbeiten" },
      {
        text: "PDF-Seiten organisieren, zusammenführen, teilen und neu anordnen",
      },
      { text: "Pro-Passwortschutz & sichere externe Link-Freigabe" },
      {
        text: "Bis zu 2× schnellere Verarbeitung & unbegrenzte Komprimierungen",
      },
    ],
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
    cardDeclinedHeading: "Ihre Karte wurde abgelehnt und nicht belastet.",
    cardDeclinedBody:
      "Versuchen Sie eine andere Karte oder wenden Sie sich an Ihre Bank. Sie können die Daten unten erneut eingeben.",
    tryAnotherCard: "Andere Karte versuchen",
    verifyingPaymentTitle: "Zahlung wird überprüft…",
    verifyingPaymentBody:
      "Das dauert in der Regel einige Sekunden. Bitte schließen Sie dieses Fenster nicht.",
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
  headerSubtitle: "Cancela cuando quieras · Pago seguro · Acceso instantáneo",
  documentReady: "Tu documento está listo para descargar",
  mostPopular: "🚀 Más popular",
  limitedPlan: "Acceso Limitado 7 días",
  fullAccessPlan: "Acceso Completo 7 días",
  annualPlan: "Plan anual",
  perMonth: "/ mes",
  billedAsYear: (p) => `Facturado como ${p} / año`,
  planFeatures: {
    limited: [
      { text: "Ediciones ilimitadas" },
      { text: "Descargas ilimitadas" },
      { text: "Conversión multiformato (PDF a Word, JPG, Excel, etc.)" },
      { text: "Sin instalación" },
      { text: "Editar texto e imágenes en archivos PDF" },
      { text: "Organizar y reordenar páginas PDF", included: false },
      {
        text: "Protección Pro con contraseña y uso compartido por enlace externo",
        included: false,
      },
      {
        text: "Motor de alta velocidad (hasta 2× más rápido)",
        included: false,
      },
    ],
    fullAccess: [
      { text: "Ediciones y descargas ilimitadas" },
      { text: "Conversión multiformato" },
      { text: "Sin instalación" },
      { text: "Editar texto, imágenes, anotaciones y formas" },
      { text: "Organizar, combinar, dividir y reordenar páginas PDF" },
      {
        text: "Protección Pro con contraseña y uso compartido seguro por enlace externo",
      },
      { text: "Hasta 2× más rápido y compresiones ilimitadas" },
    ],
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
    verifyingPaymentTitle: "Verificando tu pago…",
    verifyingPaymentBody:
      "Esto suele tardar unos segundos. Por favor, no cierres esta ventana.",
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
  limitedPlan: "Accès Limité 7 jours",
  fullAccessPlan: "Accès Complet 7 jours",
  annualPlan: "Plan annuel",
  perMonth: "/ mois",
  billedAsYear: (p) => `Facturé ${p} / an`,
  planFeatures: {
    limited: [
      { text: "Modifications illimitées" },
      { text: "Téléchargements illimités" },
      { text: "Conversion multi-format (PDF vers Word, JPG, Excel, etc.)" },
      { text: "Aucune installation requise" },
      { text: "Modifier le texte et les images des PDF" },
      { text: "Organiser et réordonner les pages PDF", included: false },
      {
        text: "Protection Pro par mot de passe & partage par lien externe",
        included: false,
      },
      {
        text: "Moteur haute vitesse (jusqu'à 2× plus rapide)",
        included: false,
      },
    ],
    fullAccess: [
      { text: "Modifications & téléchargements illimités" },
      { text: "Conversion multi-format" },
      { text: "Aucune installation requise" },
      { text: "Modifier texte, images, annotations et formes" },
      { text: "Organiser, fusionner, séparer et réordonner les pages PDF" },
      {
        text: "Protection Pro par mot de passe & partage sécurisé par lien externe",
      },
      { text: "Jusqu'à 2× plus rapide & compressions illimitées" },
    ],
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
    verifyingPaymentTitle: "Vérification de votre paiement…",
    verifyingPaymentBody:
      "Cela prend généralement quelques secondes. Veuillez ne pas fermer cette fenêtre.",
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
  limitedPlan: "Acesso Limitado por 7 dias",
  fullAccessPlan: "Acesso Completo por 7 dias",
  annualPlan: "Plano anual",
  perMonth: "/ mês",
  billedAsYear: (p) => `Cobrado como ${p} / ano`,
  planFeatures: {
    limited: [
      { text: "Edições ilimitadas" },
      { text: "Downloads ilimitados" },
      {
        text: "Conversão em múltiplos formatos (PDF para Word, JPG, Excel etc.)",
      },
      { text: "Nenhuma instalação necessária" },
      { text: "Editar texto e imagens em arquivos PDF" },
      { text: "Organizar e reordenar páginas do PDF", included: false },
      {
        text: "Proteção Pro por senha e compartilhamento por link externo",
        included: false,
      },
      {
        text: "Motor de alta velocidade (até 2× mais rápido)",
        included: false,
      },
    ],
    fullAccess: [
      { text: "Edições e downloads ilimitados" },
      { text: "Conversão em múltiplos formatos" },
      { text: "Nenhuma instalação necessária" },
      { text: "Editar texto, imagens, anotações e formas" },
      { text: "Organizar, mesclar, dividir e reordenar páginas do PDF" },
      {
        text: "Proteção Pro por senha e compartilhamento seguro por link externo",
      },
      { text: "Até 2× mais rápido e compressões ilimitadas" },
    ],
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
    verifyingPaymentTitle: "Verificando o seu pagamento…",
    verifyingPaymentBody:
      "Isto costuma demorar alguns segundos. Por favor, não feche esta janela.",
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
  limitedPlan: "وصول محدود لمدة 7 أيام",
  fullAccessPlan: "وصول كامل لمدة 7 أيام",
  annualPlan: "الخطة السنوية",
  perMonth: "/ شهر",
  billedAsYear: (p) => `تُفوتر بمبلغ ${p} / سنة`,
  planFeatures: {
    limited: [
      { text: "تعديلات غير محدودة" },
      { text: "تنزيلات غير محدودة" },
      { text: "التحويل بصيغ متعددة (PDF إلى Word وJPG وExcel وغيرها)" },
      { text: "لا يتطلب تثبيت" },
      { text: "تحرير النصوص والصور في ملفات PDF" },
      { text: "تنظيم وإعادة ترتيب صفحات PDF", included: false },
      { text: "حماية Pro بكلمة مرور ومشاركة عبر رابط خارجي", included: false },
      { text: "محرك عالي السرعة (أسرع بمعدل 2×)", included: false },
    ],
    fullAccess: [
      { text: "تعديلات وتنزيلات غير محدودة" },
      { text: "التحويل بصيغ متعددة" },
      { text: "لا يتطلب تثبيت" },
      { text: "تحرير النصوص والصور والتعليقات التوضيحية والأشكال" },
      { text: "تنظيم ودمج وتقسيم وإعادة ترتيب صفحات PDF" },
      { text: "حماية Pro بكلمة مرور ومشاركة آمنة عبر رابط خارجي" },
      { text: "أسرع بمعدل 2× وضغط غير محدود" },
    ],
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
    verifyingPaymentTitle: "جارٍ التحقق من دفعتك…",
    verifyingPaymentBody:
      "عادةً ما يستغرق ذلك بضع ثوانٍ. يرجى عدم إغلاق هذه النافذة.",
    preparing: "جارٍ التحضير…",
  },
};

const table: Record<string, PaywallStrings> = { en, de, es, fr, pt, ar };

export function getPaywallStrings(locale: Locale | string): PaywallStrings {
  return table[locale] ?? en;
}
