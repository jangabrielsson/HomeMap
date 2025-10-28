#!/bin/bash

# Create a temporary SVG file with a house icon on blue circle
cat > /tmp/homemap-icon.svg << 'EOF'
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Blue circle background -->
  <circle cx="512" cy="512" r="512" fill="#2196F3"/>
  
  <!-- White house icon -->
  <g transform="translate(512, 512)">
    <!-- Roof -->
    <path d="M -200 -50 L 0 -250 L 200 -50 L 150 -50 L 150 0 L -150 0 L -150 -50 Z" 
          fill="white"/>
    
    <!-- House body -->
    <rect x="-150" y="0" width="300" height="250" fill="white"/>
    
    <!-- Door -->
    <rect x="-50" y="100" width="100" height="150" fill="#1976D2"/>
    
    <!-- Windows -->
    <rect x="-130" y="40" width="60" height="60" fill="#1976D2"/>
    <rect x="70" y="40" width="60" height="60" fill="#1976D2"/>
  </g>
</svg>
EOF

echo "SVG icon created at /tmp/homemap-icon.svg"
echo ""
echo "To convert to PNG files, you can use ImageMagick or an online converter:"
echo "1. Open https://cloudconvert.com/svg-to-png"
echo "2. Upload /tmp/homemap-icon.svg"
echo "3. Download and save as icon.png (1024x1024)"
echo ""
echo "Or if you have ImageMagick installed:"
echo "  convert /tmp/homemap-icon.svg -resize 1024x1024 icon.png"
echo ""
echo "Then use this command to generate all icon sizes:"
echo "  cd src-tauri && cargo tauri icon icon.png"
