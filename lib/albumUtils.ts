/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Helper function to load an image and return it as an HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Setting crossOrigin is good practice for canvas operations, even with data URLs
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
        img.src = src;
    });
}

/**
 * Creates a single "lookbook" page image from a collection of pimp archetype images.
 * @param imageData A record mapping names to their image data URLs.
 * @returns A promise that resolves to a data URL of the generated lookbook page (JPEG format).
 */
export async function createLookbookPage(imageData: Record<string, string>): Promise<string> {
    const canvas = document.createElement('canvas');
    // High-resolution canvas for good quality (A4-like ratio)
    const canvasWidth = 2480;
    const canvasHeight = 3508;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get 2D canvas context');
    }

    // 1. Draw the gritty background
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Add a subtle concrete texture
    for (let i = 0; i < 150000; i++) {
        const color = Math.floor(Math.random() * 50) + 10;
        ctx.fillStyle = `rgba(${color},${color},${color},${Math.random() * 0.5})`;
        ctx.fillRect(Math.random() * canvasWidth, Math.random() * canvasHeight, 2, 2);
    }


    // 2. Draw the title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 220px 'Monoton', cursive`;
    
    // Neon effect for title
    ctx.shadowColor = '#f0f';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#f0f';
    ctx.fillText('HAMBURG', canvasWidth / 2, 180);

    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#0ff';
    ctx.fillText("'84", canvasWidth / 2, 400);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;


    // 3. Load all the images concurrently
    const figures = Object.keys(imageData);
    const loadedImages = await Promise.all(
        Object.values(imageData).map(url => loadImage(url))
    );

    const imagesWithFigures = figures.map((figure, index) => ({
        figure,
        img: loadedImages[index],
    }));

    // 4. Define layout and draw each photo
    const grid = { cols: 2, rows: 3, padding: 100 };
    const contentTopMargin = 550; // Space for the header
    const contentHeight = canvasHeight - contentTopMargin;
    const cellWidth = (canvasWidth - grid.padding * (grid.cols + 1)) / grid.cols;
    const cellHeight = (contentHeight - grid.padding * (grid.rows + 1)) / grid.rows;

    const photoWidth = cellWidth * 0.9;
    const photoHeight = photoWidth * 1.25; // A bit taller than a standard polaroid

    imagesWithFigures.forEach(({ figure, img }, index) => {
        const row = Math.floor(index / grid.cols);
        const col = index % grid.cols;

        const x = grid.padding * (col + 1) + cellWidth * col + (cellWidth - photoWidth) / 2;
        const y = contentTopMargin + grid.padding * (row + 1) + cellHeight * row;
        
        ctx.save();
        ctx.translate(x + photoWidth / 2, y + photoHeight / 2);
        
        // Apply a stronger, random rotation for a scattered look
        const rotation = (Math.random() - 0.5) * 0.15; 
        ctx.rotate(rotation);
        
        // Draw a harsh shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 35;
        ctx.shadowOffsetX = 15;
        ctx.shadowOffsetY = 20;
        
        // Draw the white photo border
        ctx.fillStyle = '#f0f0e5'; // Off-white, aged paper
        ctx.fillRect(-photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight);
        
        ctx.shadowColor = 'transparent';
        
        const inset = 35;
        const imageContainerWidth = photoWidth - inset * 2;
        const imageContainerHeight = photoHeight - inset * 2 - 100; // Leave space for caption

        const aspectRatio = img.naturalWidth / img.naturalHeight;
        let drawWidth = imageContainerWidth;
        let drawHeight = drawWidth / aspectRatio;

        if (drawHeight > imageContainerHeight) {
            drawHeight = imageContainerHeight;
            drawWidth = drawHeight * aspectRatio;
        }
        
        const imgX = -drawWidth / 2;
        const imgY = -photoHeight/2 + inset + (imageContainerHeight - drawHeight) / 2;
        
        ctx.drawImage(img, imgX, imgY, drawWidth, drawHeight);
        
        // Draw the handwritten caption
        ctx.fillStyle = '#111';
        ctx.font = `80px 'Permanent Marker', cursive`;
        ctx.textAlign = 'center';
        const captionY = (photoHeight / 2) - 60;
        ctx.fillText(figure, 0, captionY);

        // Draw "tape" on corners
        ctx.fillStyle = 'rgba(255, 255, 180, 0.6)';
        ctx.rotate(0.8); // Rotate the tape slightly differently
        ctx.fillRect(-photoWidth/2 - 20, -photoHeight/2 - 50, 180, 50);
        ctx.rotate(-1.6);
        ctx.fillRect(photoWidth/2 - 160, photoHeight/2, 180, 50);
        
        ctx.restore();
    });

    return canvas.toDataURL('image/jpeg', 0.9);
}