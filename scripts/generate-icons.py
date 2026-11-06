#!/usr/bin/env python3
"""
Generate crisp SVG and PNG icons for WhatsApp Linux desktop client.
Includes app icon, dock icons at multiple resolutions, and tray icons (normal & with unread dot).
"""

import os
import math
import cairo

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
os.makedirs(ASSETS_DIR, exist_ok=True)

SVG_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="waGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2fe571"/>
      <stop offset="100%" stop-color="#128c7e"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  
  <!-- Outer glowing circle -->
  <circle cx="256" cy="256" r="236" fill="url(#waGradient)" filter="url(#shadow)"/>
  
  <!-- Speech bubble with tail -->
  <path fill="#ffffff" d="M 256 96 C 167.6 96 96 167.6 96 256 C 96 287.6 105.2 317 121.2 342 L 104 408 L 172.4 391 C 196.8 406.8 225.4 416 256 416 C 344.4 416 416 344.4 416 256 C 416 167.6 344.4 96 256 96 Z"/>
  
  <!-- Green inner speech bubble -->
  <path fill="#25D366" d="M 256 114 C 177.5 114 114 177.5 114 256 C 114 284 122.2 310.2 136.5 332.4 L 122 388 L 180 373 C 201.8 387 227.8 395 256 395 C 334.5 395 398 331.5 398 256 C 398 177.5 334.5 114 256 114 Z"/>
  
  <!-- Phone Handset -->
  <path fill="#ffffff" d="M 335.5 301 C 331.2 299 310.2 288.6 306.3 287.2 C 302.4 285.8 299.6 285.1 296.8 289.4 C 294 293.7 285.8 303.6 283.3 306.5 C 280.8 309.3 278.3 309.7 274 307.6 C 269.7 305.5 255.8 300.9 239.3 286.2 C 226.4 274.7 217.7 260.5 215.2 256.2 C 212.7 251.9 214.9 249.6 217.1 247.5 C 219 245.6 221.3 242.6 223.5 240.1 C 225.6 237.6 226.3 235.8 227.8 232.9 C 229.2 230.1 228.5 227.6 227.4 225.5 C 226.3 223.3 217.7 202.2 214.2 193.7 C 210.7 185.3 207.2 186.5 204.6 186.4 C 202.2 186.3 199.4 186.3 196.5 186.3 C 193.7 186.3 189 187.4 185.1 191.6 C 181.2 195.9 170.2 206.2 170.2 227.2 C 170.2 248.2 185.5 268.5 187.6 271.3 C 189.7 274.2 217.7 317.3 260.6 335.8 C 270.8 340.2 278.8 342.9 285 344.9 C 295.2 348.1 304.5 347.7 311.9 346.6 C 320.1 345.4 337.2 336.2 340.8 326.1 C 344.3 316 344.3 307.4 343.2 305.3 C 342.1 303.1 339.8 302.4 335.5 301 Z"/>
</svg>
"""

def render_svg_to_png(svg_str, output_path, width, height):
    import gi
    gi.require_version('Rsvg', '2.0')
    from gi.repository import Rsvg
    
    handle = Rsvg.Handle.new_from_data(svg_str.encode('utf-8'))
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height)
    ctx = cairo.Context(surface)
    
    # Scale to match desired width/height
    dim = handle.get_intrinsic_size_in_pixels()
    if dim and len(dim) >= 3 and dim[0]:
        orig_w, orig_h = dim[1], dim[2]
    else:
        orig_w, orig_h = 512.0, 512.0
    ctx.scale(width / orig_w, height / orig_h)
    
    handle.render_cairo(ctx)
    surface.write_to_png(output_path)

def generate_tray_icon(output_path, size=32, has_badge=False):
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size)
    ctx = cairo.Context(surface)
    
    # Background circle
    radius = size * 0.44
    center = size / 2.0
    
    ctx.arc(center, center, radius, 0, 2 * math.pi)
    ctx.set_source_rgb(0.145, 0.827, 0.4) # #25D366
    ctx.fill()
    
    # White speech bubble + phone indicator
    ctx.arc(center, center, radius * 0.72, 0, 2 * math.pi)
    ctx.set_source_rgb(1.0, 1.0, 1.0)
    ctx.fill()
    
    ctx.arc(center, center, radius * 0.58, 0, 2 * math.pi)
    ctx.set_source_rgb(0.145, 0.827, 0.4)
    ctx.fill()
    
    # Simple clean phone silhouette in the middle
    ctx.set_source_rgb(1.0, 1.0, 1.0)
    ctx.arc(center, center, radius * 0.28, 0, 2 * math.pi)
    ctx.fill()
    
    if has_badge:
        # Red unread notification dot on top-right
        dot_r = size * 0.22
        dot_x = size - dot_r - 1
        dot_y = dot_r + 1
        
        ctx.arc(dot_x, dot_y, dot_r, 0, 2 * math.pi)
        ctx.set_source_rgb(0.95, 0.2, 0.2) # Bright Red
        ctx.fill()
        
        # Border around dot
        ctx.arc(dot_x, dot_y, dot_r, 0, 2 * math.pi)
        ctx.set_source_rgb(1.0, 1.0, 1.0)
        ctx.set_line_width(size * 0.06)
        ctx.stroke()
        
    surface.write_to_png(output_path)

def main():
    svg_path = os.path.join(ASSETS_DIR, "icon.svg")
    with open(svg_path, "w") as f:
        f.write(SVG_CONTENT)
    print(f"Generated SVG: {svg_path}")
    
    sizes = [16, 24, 32, 48, 64, 128, 256, 512]
    for s in sizes:
        png_path = os.path.join(ASSETS_DIR, f"icon-{s}.png")
        render_svg_to_png(SVG_CONTENT, png_path, s, s)
        print(f"Generated {s}x{s} PNG: {png_path}")
        
    # Main default icon
    main_icon = os.path.join(ASSETS_DIR, "icon.png")
    render_svg_to_png(SVG_CONTENT, main_icon, 512, 512)
    
    # Tray icons (standard and unread)
    generate_tray_icon(os.path.join(ASSETS_DIR, "tray-icon.png"), size=32, has_badge=False)
    generate_tray_icon(os.path.join(ASSETS_DIR, "tray-icon-unread.png"), size=32, has_badge=True)
    generate_tray_icon(os.path.join(ASSETS_DIR, "tray-icon-24.png"), size=24, has_badge=False)
    generate_tray_icon(os.path.join(ASSETS_DIR, "tray-icon-24-unread.png"), size=24, has_badge=True)
    print("All icons successfully generated!")

if __name__ == "__main__":
    main()
