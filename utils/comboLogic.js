export function validateCombo(comboSize, flavours) {
  const total = flavours.reduce((a, b) => a + b.qty, 0);
  if (total !== comboSize) throw new Error("Invalid combo quantity");
}
