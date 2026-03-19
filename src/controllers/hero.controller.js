const heroService = require("../services/hero.service");
const appConfig = require("../config/app.config");
const { isAbsoluteUrl, toPublicAssetUrl } = require("../utils/url.util");
const { uploadSingleFile } = require("../services/storage.service");

function resolveHeroImageSource(slide = {}) {
  const imageUrl = String(slide.image_url || "").trim();
  if (imageUrl) return imageUrl;

  const image = String(slide.image || "").trim();
  if (!image) return "";
  if (isAbsoluteUrl(image) || image.startsWith("/")) return image;
  return `/uploads/${image}`;
}

function mapHeroSlide(req, slide = {}) {
  const sourcePath = resolveHeroImageSource(slide);

  return {
    ...slide,
    image_url: toPublicAssetUrl({
      req,
      value: sourcePath,
      assetBaseUrl: appConfig.assetBaseUrl,
    }),
  };
}

async function addHero(req, res) {
  try {
    const { title, subtitle } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }
    const imagePath = await uploadSingleFile(req.file);

    await heroService.createHero({
      title,
      subtitle,
      image: imagePath,
    });

    return res.status(201).json({
      message: "Hero slide uploaded successfully",
      image: imagePath,
      image_url: toPublicAssetUrl({
        req,
        value: imagePath,
        assetBaseUrl: appConfig.assetBaseUrl,
      }),
    });
  } catch (err) {
    console.error("Hero Insert Error:", err);
    return res.status(500).json({ message: err.message || "Unable to upload hero slide" });
  }
}

async function listHeroes(req, res) {
  try {
    const rows = await heroService.getHeroes();
    res.json((rows || []).map((slide) => mapHeroSlide(req, slide)));
  } catch (err) {
    console.error("Hero Fetch Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function removeHero(req, res) {
  try {
    await heroService.deleteHero(req.params.id);
    res.json({ message: "Hero Deleted Successfully" });
  } catch (err) {
    console.error("Hero Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  addHero,
  listHeroes,
  removeHero,
};
