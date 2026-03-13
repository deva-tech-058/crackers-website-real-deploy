const categoryService = require("../services/category.service");

async function listCategories(req, res) {
  try {
    const rows = await categoryService.getCategories();
    res.json(rows);
  } catch (err) {
    console.error("Category Fetch Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function addCategory(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    await categoryService.createCategory(name);
    res.json({ message: "Category Added Successfully" });
  } catch (err) {
    console.error("Category Add Error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
}

async function editCategory(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    await categoryService.updateCategory(req.params.id, name);
    res.json({ message: "Category Updated Successfully" });
  } catch (err) {
    console.error("Category Update Error:", err);
    res.status(err.status || 500).json({ error: err.message || "Server error" });
  }
}

module.exports = {
  listCategories,
  addCategory,
  editCategory,
};

