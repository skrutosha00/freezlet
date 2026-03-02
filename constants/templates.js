import foodBasicsTemplate from "../templates/foodBasics.js";
import cityLifeTemplate from "../templates/cityLife.js";
import unit3ATemplate from "../templates/3a.js";
import unit3BTemplate from "../templates/3b.js";
import unit3CTemplate from "../templates/3c.js";
import unit3DTemplate from "../templates/3d.js";
import unit3ETemplate from "../templates/3e.js";
import unit3FTemplate from "../templates/3f.js";
import slugify from "../utils/slugify.js";
import uid from "../utils/uid.js";

const BUILT_IN_TEMPLATES = [
  foodBasicsTemplate,
  cityLifeTemplate,
  unit3ATemplate,
  unit3BTemplate,
  unit3CTemplate,
  unit3DTemplate,
  unit3ETemplate,
  unit3FTemplate
]
  .filter((t) => t && typeof t === "object")
  .map((t) => ({
    templateId: slugify(t.name) || uid(),
    name: String(t.name ?? "Template").trim() || "Template",
    words: Array.isArray(t.words) ? t.words : []
  }));

export default BUILT_IN_TEMPLATES;
