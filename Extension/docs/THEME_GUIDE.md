# 🎨 Theme Color Guide

## How to Change Your Extension's Color Theme

All theme colors are now centralized in **one place**: `src/index.css`

You can change the entire color scheme by editing just two sections in that file!

---

## 📍 Where to Edit

Open `src/index.css` and find these two sections:

### 1. **Light Mode Colors** (around line 207)
Look for the section labeled: `BRAND THEME COLORS (LIGHT MODE)`

### 2. **Dark Mode Colors** (around line 315)
Look for the section labeled: `BRAND THEME COLORS (DARK MODE)`

---

## 🎯 How the Color System Works

### Main Brand Color (`brand-*`)
This controls your **primary color** (currently purple):
- `brand-50` to `brand-950` = Lightest to darkest shades
- Used for backgrounds, text, borders, buttons, etc.

### Accent Color (`brand-accent-*`)
This controls your **secondary/accent color** (currently pink):
- `brand-accent-400` and `brand-accent-500`
- Used for gradients and highlights

---

## 🔄 Example: Changing to Blue/Cyan Theme

### Light Mode (around line 207):
```css
/* Main brand color scale - Blue */
--brand-50: oklch(0.97 0.01 240);     /* Very light blue */
--brand-100: oklch(0.95 0.03 240);    
--brand-200: oklch(0.92 0.05 240);    
--brand-300: oklch(0.80 0.10 240);    
--brand-400: oklch(0.68 0.15 240);    
--brand-500: oklch(0.60 0.18 240);    /* Main blue */
--brand-600: oklch(0.52 0.20 240);    
--brand-700: oklch(0.44 0.18 240);    
--brand-800: oklch(0.36 0.15 240);    
--brand-900: oklch(0.28 0.12 240);    
--brand-950: oklch(0.20 0.10 240);    /* Dark blue */

/* Accent color - Cyan */
--brand-accent-400: oklch(0.72 0.18 200);  /* Light cyan */
--brand-accent-500: oklch(0.65 0.20 200);  /* Cyan */
```

### Dark Mode (around line 315):
```css
/* Main brand color scale - Blue (dark mode) */
--brand-50: oklch(0.25 0.08 240);
--brand-100: oklch(0.28 0.10 240);
--brand-200: oklch(0.32 0.12 240);
--brand-300: oklch(0.55 0.15 240);
--brand-400: oklch(0.65 0.17 240);
--brand-500: oklch(0.72 0.19 240);
--brand-600: oklch(0.60 0.16 240);
--brand-700: oklch(0.52 0.14 240);
--brand-800: oklch(0.44 0.12 240);
--brand-900: oklch(0.30 0.10 240);
--brand-950: oklch(0.22 0.08 240);

/* Accent color - Cyan (dark mode) */
--brand-accent-400: oklch(0.75 0.20 200);
--brand-accent-500: oklch(0.68 0.22 200);
```

---

## 🌈 Color Hue Reference (the 3rd number)

Change the **hue value** (third number in `oklch()`) to get different colors:

- **0-20**: Red
- **30-60**: Orange/Yellow  
- **90-150**: Green
- **180-220**: Cyan/Teal
- **240-260**: Blue
- **280-320**: Purple (current)
- **330-360**: Pink/Magenta (current accent)

### Quick Color Presets:

| Theme | Main Hue | Accent Hue |
|-------|----------|------------|
| Purple/Pink (current) | 300 | 350 |
| Blue/Cyan | 240 | 200 |
| Green/Teal | 140 | 180 |
| Orange/Red | 40 | 10 |
| Teal/Blue | 180 | 240 |

---

## 💡 Pro Tips

1. **Keep the first two numbers the same** when changing colors - only change the hue (3rd number)
2. **Test in both modes**: Make sure to check light and dark mode after changes
3. **Hot reload is enabled**: Just save the file and see changes instantly!
4. **Use a color picker**: Tools like [OKLCH Color Picker](https://oklch.com/) can help you find values

---

## 🔍 What Uses These Colors?

Everything! The entire UI now uses these centralized brand colors:

- ✅ Header and navigation
- ✅ Backgrounds and gradients
- ✅ Text colors
- ✅ Buttons
- ✅ Progress bars
- ✅ Score displays
- ✅ Borders
- ✅ Tab indicators
- ✅ All purple/pink elements throughout the app

Change the colors in `index.css`, and the entire extension updates automatically! 🎉

