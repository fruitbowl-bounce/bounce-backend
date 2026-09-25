// Same maths as calcMonthly() on the Stage 4 offer cards, so what gets
// stored (and synced to Salesforce) matches the figure the applicant saw.
// The offer templates don't carry a repayment figure — it depends on the
// requested loan amount — so the frontend's offer object never has one.
// `offer` is the public template shape (LoanOfferTemplate#asJson).
const monthlyRepaymentFor = (principal, offer) => {
  const amount = Number(principal) || 0;
  if (!amount) return null;
  let payment = null;
  if (offer.factorRate) {
    payment = (amount * Number(offer.factorRate)) / (Number(offer.termMonths) || 12);
  } else if (offer.aprValue && offer.termMonths) {
    const r = Number(offer.aprValue) / 100 / 12;
    const n = Number(offer.termMonths);
    payment = amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }
  return payment ? `£${Math.round(payment).toLocaleString('en-GB')}` : null;
};

module.exports = { monthlyRepaymentFor };
