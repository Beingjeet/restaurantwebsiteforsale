const express = require("express");
const router = express.Router();
const MenuItem = require("../models/MenuItem");

// GET all
router.get("/", async (req, res) => {
  const items = await MenuItem.find();
  res.json(items);
});

// POST create (admin)
router.post("/", async (req, res) => {
  try {
    const it = new MenuItem(req.body);
    await it.save();
    res.status(201).json(it);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT update
router.put("/:id", async (req, res) => {
  try {
    const it = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(it);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
