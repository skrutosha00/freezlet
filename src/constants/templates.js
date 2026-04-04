import foodBasicsTemplate from "../templates/foodBasics.js";
import cityLifeTemplate from "../templates/cityLife.js";
import unit3ATemplate from "../templates/3a.js";
import unit3BTemplate from "../templates/3b.js";
import unit3CTemplate from "../templates/3c.js";
import unit3DTemplate from "../templates/3d.js";
import unit3ETemplate from "../templates/3e.js";
import unit3FTemplate from "../templates/3f.js";
import unit4ATemplate from "../templates/4a.js";
import unit4BTemplate from "../templates/4b.js";
import unit4CTemplate from "../templates/4c.js";
import unit4DTemplate from "../templates/4d.js";
import laFalsaFacilidadTemplate from "../templates/laFalsaFacilidad.js";
import slugify from "../utils/slugify.js";

const TEMPLATE_ORDER = [
  "food-basics",
  "city-life",
  "unit-3a",
  "unit-3b",
  "unit-3c",
  "unit-3d",
  "unit-3e",
  "unit-3f",
  "4a",
  "4b",
  "4c",
  "4d",
  "la-falsa-facilidad"
];

const BUILT_IN_TEMPLATES = [
  foodBasicsTemplate,
  cityLifeTemplate,
  unit3ATemplate,
  unit3BTemplate,
  unit3CTemplate,
  unit3DTemplate,
  unit3ETemplate,
  unit3FTemplate,
  unit4ATemplate,
  unit4BTemplate,
  unit4CTemplate,
  unit4DTemplate,
  laFalsaFacilidadTemplate
]
  .filter((t) => t && typeof t === "object")
  .map((t, index) => {
    const name = String(t.name ?? "Template").trim() || "Template";
    return {
      templateId: String(t.templateId ?? "").trim() || slugify(name) || `template-${index + 1}`,
      name,
      words: Array.isArray(t.words) ? t.words : []
    };
  })
  .sort((a, b) => TEMPLATE_ORDER.indexOf(a.templateId) - TEMPLATE_ORDER.indexOf(b.templateId));

export default BUILT_IN_TEMPLATES;
