const heroService = require("../services/hero.service");

async function addHero(req, res) {
  try {
    const { title, subtitle } = req.body;
    if (!req.file) {
      return res.status(400).send("Image is required");
    }

    await heroService.createHero({
      title,
      subtitle,
      image: req.file.filename,
    });

    res.redirect("/admin/admin-hero.html");
  } catch (err) {
    console.error("Hero Insert Error:", err);
    res.status(500).send(err.message);
  }
}

async function listHeroes(req, res) {
  try {
    const rows = await heroService.getHeroes();
    res.json(rows);
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

