# The Copper Roost — Website

A showcase website for The Copper Roost barndominium vacation rental near Lake Texoma, Oklahoma.

## 📁 File Structure

```
/
├── index.html          ← The whole website (single file)
├── rooster.png         ← Logo/rooster image (add yours here)
├── photos/
│   ├── manifest.json   ← List of photo filenames to display
│   ├── photo-01.jpg
│   ├── photo-02.jpg
│   └── ...
└── README.md
```

## 🖼️ Adding Photos

1. Drop your `.jpg` / `.png` photos into the `photos/` folder
2. Name them however you like (e.g. `bedroom-1.jpg`, `patio.jpg`)
3. Open `photos/manifest.json` and update the list:

```json
[
  "bedroom-1.jpg",
  "patio.jpg",
  "living-room.jpg",
  "bunk-room.jpg",
  "exterior.jpg",
  "kitchen.jpg"
]
```

The gallery will automatically load whatever is listed there. First few photos are also used in the "About" section image stack.

## 📋 Event Form Setup (Formspree)

The event request form uses [Formspree](https://formspree.io) — free for basic use.

1. Go to [formspree.io](https://formspree.io) and create a free account
2. Create a new form, copy your form ID (looks like `xyzabcde`)
3. In `index.html`, find this line:
   ```js
   const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORMSPREE_ID';
   ```
4. Replace `YOUR_FORMSPREE_ID` with your actual ID

Form submissions will be emailed to you automatically.

## 🚀 Deploying to GitHub Pages

1. Push this folder to a GitHub repo (e.g. `copper-roost`)
2. Go to **Settings → Pages**
3. Source: **Deploy from a branch** → `main` → `/ (root)`
4. Site will be live at `https://yourusername.github.io/copper-roost/`

## ✏️ Customizations

- **Logo**: Replace `rooster.png` with the actual rooster/logo image
- **Book Now link**: Already points to the Evolve listing
- **Facebook link**: Already points to TheCopperRoost Facebook page
- **YouTube video**: Already embedded (property tour video)
- **Colors**: Edit CSS variables at the top of `index.html` (`:root { --copper: ... }`)
