const normalize = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

export default normalize;
