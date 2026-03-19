const productService = require("../services/product.service");
const appConfig = require("../config/app.config");
const { toPublicAssetUrl } = require("../utils/url.util");
const { uploadSingleFile } = require("../services/storage.service");

function mapProductMediaUrls(req, product = {}) {
  return {
    ...product,
    image_url: toPublicAssetUrl({
      req,
      value: product.image_url,
      assetBaseUrl: appConfig.assetBaseUrl,
    }),
    video_url: toPublicAssetUrl({
      req,
      value: product.video_url,
      assetBaseUrl: appConfig.assetBaseUrl,
    }),
  };
}

async function listProducts(req, res) {
  try {
    const rows = await productService.getProducts();
    res.json((rows || []).map((row) => mapProductMediaUrls(req, row)));
  } catch (err) {
    console.error("Product Fetch Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function addProduct(req, res) {
  try {
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    if (!imageFile) {
      return res.status(400).json({ error: "Product image required" });
    }

    const is_best_selling =
      req.body.is_best_selling === "on" || req.body.is_best_selling === "true";
    const [imageUrl, videoUrl] = await Promise.all([
      uploadSingleFile(imageFile),
      uploadSingleFile(videoFile),
    ]);

    await productService.createProduct({
      ...req.body,
      is_best_selling,
      image_url: imageUrl,
      video_url: videoUrl,
    });

    res.json({ message: "Product Added Successfully" });
  } catch (err) {
    console.error("Product Add Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function editProduct(req, res) {
  try {
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    const is_best_selling =
      req.body.is_best_selling === "on" || req.body.is_best_selling === "true";
    const [imageUrl, videoUrl] = await Promise.all([
      uploadSingleFile(imageFile),
      uploadSingleFile(videoFile),
    ]);

    await productService.updateProduct(req.params.id, {
      ...req.body,
      is_best_selling,
      image_url: imageUrl,
      video_url: videoUrl,
    });

    res.json({ message: "Product Updated Successfully" });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function removeProduct(req, res) {
  try {
    await productService.deleteProduct(req.params.id);
    res.json({ message: "Product Deleted Successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listProducts,
  addProduct,
  editProduct,
  removeProduct,
};
