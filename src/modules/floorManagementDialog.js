// floorManagementDialog.js - Floor add/edit/delete dialogs
export class FloorManagementDialog {
    constructor(app) {
        this.app = app;
        
        // Get Tauri APIs
        this.invoke = window.__TAURI__.core.invoke;
        this.dialog = window.__TAURI__.dialog;
        this.fs = window.__TAURI__.fs;
        this.path = window.__TAURI__.path;
    }

    /**
     * Show Add Floor dialog
     */
    async showAddFloorDialog() {
        console.log('showAddFloorDialog called');
        
        const dialog = document.createElement('div');
        dialog.className = 'slider-modal';
        dialog.innerHTML = `
            <div class="slider-content edit-dialog">
                <h3>Add Floor</h3>
                <div class="edit-form">
                    <div class="form-group">
                        <label>Floor Name:</label>
                        <input type="text" id="addFloorName" class="form-input" placeholder="e.g., Living Room">
                    </div>
                    
                    <div class="form-group">
                        <label>Background Image:</label>
                        <button id="selectFloorImage" class="primary-button">Select Image...</button>
                        <div id="selectedImagePath" style="margin-top: 8px; color: #aaa; font-size: 12px;"></div>
                    </div>
                    
                    <div id="imagePreviewContainer" style="display: none; margin-top: 16px;">
                        <label>Preview:</label>
                        <div style="max-width: 400px; max-height: 300px; overflow: hidden; border: 1px solid #444; border-radius: 4px;">
                            <img id="imagePreview" style="width: 100%; height: auto;">
                        </div>
                        <div style="margin-top: 8px; color: #aaa; font-size: 12px;">
                            Dimensions: <span id="imageDimensions"></span>
                        </div>
                    </div>
                    
                    <div class="form-group" id="dimensionsGroup" style="display: none;">
                        <label>Floor Dimensions (pixels):</label>
                        <div style="display: flex; gap: 12px; align-items: flex-end;">
                            <div style="flex: 1;">
                                <label style="font-size: 12px; color: #aaa;">Width:</label>
                                <input type="number" id="floorWidth" class="form-input" min="100" step="10">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 12px; color: #aaa;">Height:</label>
                                <input type="number" id="floorHeight" class="form-input" min="100" step="10">
                            </div>
                        </div>
                        <div style="margin-top: 8px; display: flex; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; white-space: nowrap;">
                                <input type="checkbox" id="keepAspectRatio" checked style="cursor: pointer;">
                                <span>Keep aspect ratio</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="dialog-buttons">
                    <button id="addFloorCancel" class="secondary-button">Cancel</button>
                    <button id="addFloorSave" class="primary-button" disabled>Add Floor</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        let selectedImageData = null;
        let imageWidth = 0;
        let imageHeight = 0;

        // Select image button
        const selectBtn = dialog.querySelector('#selectFloorImage');
        const imagePath = dialog.querySelector('#selectedImagePath');
        const previewContainer = dialog.querySelector('#imagePreviewContainer');
        const preview = dialog.querySelector('#imagePreview');
        const dimensions = dialog.querySelector('#imageDimensions');
        const dimensionsGroup = dialog.querySelector('#dimensionsGroup');
        const widthInput = dialog.querySelector('#floorWidth');
        const heightInput = dialog.querySelector('#floorHeight');
        const nameInput = dialog.querySelector('#addFloorName');
        const saveBtn = dialog.querySelector('#addFloorSave');
        const keepAspectRatio = dialog.querySelector('#keepAspectRatio');
        
        let aspectRatio = 1;
        let isUpdating = false;

        // Aspect ratio handling
        widthInput.addEventListener('input', () => {
            if (keepAspectRatio.checked && !isUpdating && aspectRatio > 0) {
                isUpdating = true;
                const newHeight = Math.round(widthInput.value / aspectRatio);
                heightInput.value = newHeight;
                isUpdating = false;
            }
        });

        heightInput.addEventListener('input', () => {
            if (keepAspectRatio.checked && !isUpdating && aspectRatio > 0) {
                isUpdating = true;
                const newWidth = Math.round(heightInput.value * aspectRatio);
                widthInput.value = newWidth;
                isUpdating = false;
            }
        });

        selectBtn.addEventListener('click', async () => {
            console.log('Select image button clicked');
            try {
                console.log('Opening file dialog...');
                console.log('this.dialog:', this.dialog);
                
                // Use Tauri file dialog to select image
                const result = await this.dialog.open({
                    multiple: false,
                    filters: [{
                        name: 'Images',
                        extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
                    }]
                });

                if (result) {
                    // Read file as base64 using Tauri command
                    const dataUrl = await this.invoke('read_image_as_base64', { imagePath: result });

                    // Show preview
                    preview.src = dataUrl;
                    preview.onload = () => {
                        imageWidth = preview.naturalWidth;
                        imageHeight = preview.naturalHeight;
                        aspectRatio = imageWidth / imageHeight;
                        dimensions.textContent = `${imageWidth} × ${imageHeight}`;
                        widthInput.value = imageWidth;
                        heightInput.value = imageHeight;
                        dimensionsGroup.style.display = 'block';
                    };

                    previewContainer.style.display = 'block';
                    imagePath.textContent = result.split(/[/\\]/).pop(); // Handle both / and \ path separators
                    
                    selectedImageData = {
                        path: result,
                        dataUrl: dataUrl,
                        filename: result.split(/[/\\]/).pop() // Handle both / and \ path separators
                    };

                    // Enable save button if name is also filled
                    if (nameInput.value.trim()) {
                        saveBtn.disabled = false;
                    }
                }
            } catch (error) {
                console.error('Failed to select image:', error);
                alert('Failed to select image: ' + error.message);
            }
        });

        // Enable save button when name is entered
        nameInput.addEventListener('input', () => {
            saveBtn.disabled = !(nameInput.value.trim() && selectedImageData);
        });

        // Cancel button
        dialog.querySelector('#addFloorCancel').addEventListener('click', () => {
            dialog.remove();
        });

        // Save button
        saveBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);

            if (!name || !selectedImageData || !width || !height) {
                alert('Please fill in all fields');
                return;
            }

            // Check for duplicate floor name
            if (this.app.homemapConfig.floors.some(f => f.name.toLowerCase() === name.toLowerCase())) {
                alert('A floor with this name already exists');
                return;
            }

            try {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Adding...';

                // Generate unique floor ID
                const floorId = 'floor_' + Date.now();

                // Copy image to homemapdata/floors/<floor-id>/
                const imageFilename = await this.copyImageToFloorDirectory(floorId, selectedImageData);

                // Create new floor object
                const newFloor = {
                    id: floorId,
                    name: name,
                    image: `floors/${floorId}/${imageFilename}`,
                    width: width,
                    height: height
                };

                // Add to config
                this.app.homemapConfig.floors.push(newFloor);

                // Save config
                await this.app.saveConfig();

                // Render floors
                await this.app.floorManager.renderFloors();

                // Switch to new floor
                this.app.floorManager.showFloor(floorId);

                // Close dialog
                dialog.remove();

                console.log('Added floor:', newFloor);

            } catch (error) {
                console.error('Failed to add floor:', error);
                alert('Failed to add floor: ' + error.message);
                saveBtn.disabled = false;
                saveBtn.textContent = 'Add Floor';
            }
        });

        // Close on overlay click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    /**
     * Show Edit Floor dialog
     */
    async showEditFloorDialog(floor) {
        console.log('showEditFloorDialog called for floor:', floor);
        
        const dialog = document.createElement('div');
        dialog.className = 'slider-modal';
        
        // Get current floor position
        const floorIndex = this.app.homemapConfig.floors.findIndex(f => f.id === floor.id);
        const canMoveUp = floorIndex > 0;
        const canMoveDown = floorIndex < this.app.homemapConfig.floors.length - 1;

        dialog.innerHTML = `
            <div class="slider-content edit-dialog">
                <h3>Edit Floor</h3>
                <div class="edit-form">
                    <div class="form-group">
                        <label>Floor Name:</label>
                        <input type="text" id="editFloorName" class="form-input" value="${this.escapeHtml(floor.name)}">
                    </div>
                    
                    <div class="form-group">
                        <label>Background Image:</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button id="changeFloorImage" class="secondary-button">Change Image...</button>
                            <span style="color: #aaa; font-size: 12px;">${floor.image ? floor.image.split('/').pop() : 'No image'}</span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 16px;">
                        <label>Current Preview:</label>
                        <div style="max-width: 400px; max-height: 300px; overflow: hidden; border: 1px solid #444; border-radius: 4px; margin-top: 8px; background: #1e2a35;">
                            <img id="currentPreview" src="" style="width: 100%; height: auto; display: none;">
                            <div id="previewPlaceholder" style="display: flex; align-items: center; justify-content: center; height: 200px; color: #666;">
                                Loading preview...
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-top: 16px;">
                        <label>Floor Dimensions (pixels):</label>
                        <div style="display: flex; gap: 12px; align-items: flex-end;">
                            <div style="flex: 1;">
                                <label style="font-size: 12px; color: #aaa;">Width:</label>
                                <input type="number" id="editFloorWidth" class="form-input" min="100" step="10" value="${floor.width}">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 12px; color: #aaa;">Height:</label>
                                <input type="number" id="editFloorHeight" class="form-input" min="100" step="10" value="${floor.height}">
                            </div>
                        </div>
                        <div style="margin-top: 8px; display: flex; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; white-space: nowrap;">
                                <input type="checkbox" id="editKeepAspectRatio" checked style="cursor: pointer;">
                                <span>Keep aspect ratio</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Floor Order:</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button id="moveFloorUp" class="secondary-button" ${!canMoveUp ? 'disabled' : ''}>↑ Move Up</button>
                            <button id="moveFloorDown" class="secondary-button" ${!canMoveDown ? 'disabled' : ''}>↓ Move Down</button>
                            <span style="color: #aaa; font-size: 12px;">Position: ${floorIndex + 1} of ${this.app.homemapConfig.floors.length}</span>
                        </div>
                    </div>
                </div>
                <div class="dialog-buttons">
                    <button id="editFloorCancel" class="secondary-button">Cancel</button>
                    <button id="editFloorSave" class="primary-button">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        let newImageData = null;
        const preview = dialog.querySelector('#currentPreview');
        const previewPlaceholder = dialog.querySelector('#previewPlaceholder');
        const nameInput = dialog.querySelector('#editFloorName');
        const widthInput = dialog.querySelector('#editFloorWidth');
        const heightInput = dialog.querySelector('#editFloorHeight');

        // Load current floor image
        if (floor.image) {
            const imagePath = `${this.app.dataPath}/${floor.image}`;
            console.log('Loading floor image preview from:', imagePath);
            
            this.invoke('read_image_as_base64', { imagePath: imagePath })
                .then(base64Data => {
                    preview.src = base64Data;
                    preview.style.display = 'block';
                    previewPlaceholder.style.display = 'none';
                })
                .catch(error => {
                    console.error('Failed to load floor image:', error);
                    previewPlaceholder.textContent = 'Failed to load image: ' + error;
                    previewPlaceholder.style.color = '#f44336';
                });
        } else {
            previewPlaceholder.textContent = 'No image set';
        }

        // Aspect ratio handling
        const keepAspectRatio = dialog.querySelector('#editKeepAspectRatio');
        let aspectRatio = floor.width / floor.height;
        let isUpdating = false;

        widthInput.addEventListener('input', () => {
            if (keepAspectRatio.checked && !isUpdating) {
                isUpdating = true;
                const newHeight = Math.round(widthInput.value / aspectRatio);
                heightInput.value = newHeight;
                isUpdating = false;
            }
        });

        heightInput.addEventListener('input', () => {
            if (keepAspectRatio.checked && !isUpdating) {
                isUpdating = true;
                const newWidth = Math.round(heightInput.value * aspectRatio);
                widthInput.value = newWidth;
                isUpdating = false;
            }
        });

        // Change image button
        dialog.querySelector('#changeFloorImage').addEventListener('click', async () => {
            try {
                const result = await this.dialog.open({
                    multiple: false,
                    filters: [{
                        name: 'Images',
                        extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
                    }]
                });

                if (result) {
                    // Read file as base64 using Tauri command
                    const dataUrl = await this.invoke('read_image_as_base64', { imagePath: result });

                    preview.src = dataUrl;
                    preview.style.display = 'block';
                    previewPlaceholder.style.display = 'none';
                    preview.onload = () => {
                        widthInput.value = preview.naturalWidth;
                        heightInput.value = preview.naturalHeight;
                        // Update aspect ratio when new image is loaded
                        aspectRatio = preview.naturalWidth / preview.naturalHeight;
                    };

                    newImageData = {
                        path: result,
                        dataUrl: dataUrl,
                        filename: result.split(/[/\\]/).pop() // Handle both / and \ path separators
                    };
                }
            } catch (error) {
                console.error('Failed to select image:', error);
                alert('Failed to select image: ' + error.message);
            }
        });

        // Move floor up
        dialog.querySelector('#moveFloorUp').addEventListener('click', async () => {
            await this.moveFloor(floor.id, -1);
            dialog.remove();
        });

        // Move floor down
        dialog.querySelector('#moveFloorDown').addEventListener('click', async () => {
            await this.moveFloor(floor.id, 1);
            dialog.remove();
        });

        // Cancel button
        dialog.querySelector('#editFloorCancel').addEventListener('click', () => {
            dialog.remove();
        });

        // Save button
        dialog.querySelector('#editFloorSave').addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);

            if (!name || !width || !height) {
                alert('Please fill in all fields');
                return;
            }

            // Check for duplicate floor name (excluding current floor)
            if (this.app.homemapConfig.floors.some(f => f.id !== floor.id && f.name.toLowerCase() === name.toLowerCase())) {
                alert('A floor with this name already exists');
                return;
            }

            try {
                const saveBtn = dialog.querySelector('#editFloorSave');
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';

                // Update floor properties
                floor.name = name;
                floor.width = width;
                floor.height = height;

                // If new image selected, copy it and update background path
                if (newImageData) {
                    const imageFilename = await this.copyImageToFloorDirectory(floor.id, newImageData);
                    floor.image = `floors/${floor.id}/${imageFilename}`;
                }

                // Save config
                await this.app.saveConfig();

                // Re-render floors
                await this.app.floorManager.renderFloors();

                // Close dialog
                dialog.remove();

                console.log('Updated floor:', floor);

            } catch (error) {
                console.error('Failed to update floor:', error);
                alert('Failed to update floor: ' + error.message);
            }
        });

        // Close on overlay click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    /**
     * Delete a floor
     */
    async deleteFloor(floor) {
        // Check if this is the last floor
        if (this.app.homemapConfig.floors.length <= 1) {
            alert(`Cannot delete the last floor.\n\nThe app requires at least one floor. You can edit this floor instead.`);
            return;
        }
        
        // Check if floor has devices
        const devicesOnFloor = this.app.homemapConfig.devices.filter(d => d.floor_id === floor.id);
        
        if (devicesOnFloor.length > 0) {
            alert(`Cannot delete floor "${floor.name}" - it contains ${devicesOnFloor.length} device(s).\n\nPlease remove all devices from this floor first.`);
            return;
        }

        // Confirm deletion
        if (!confirm(`Delete floor "${floor.name}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            // Remove floor from config
            const index = this.app.homemapConfig.floors.findIndex(f => f.id === floor.id);
            if (index !== -1) {
                this.app.homemapConfig.floors.splice(index, 1);
            }

            // Save config
            await this.app.saveConfig();

            // Re-render floors (will switch to first available floor)
            await this.app.floorManager.renderFloors();

            console.log('Deleted floor:', floor.name);

            // TODO: Delete floor directory and images (optional, for cleanup)
            // Could add Tauri command to delete: homemapdata/floors/<floor-id>/

        } catch (error) {
            console.error('Failed to delete floor:', error);
            alert('Failed to delete floor: ' + error.message);
        }
    }

    /**
     * Move floor up or down in the list
     */
    async moveFloor(floorId, direction) {
        const floors = this.app.homemapConfig.floors;
        const index = floors.findIndex(f => f.id === floorId);
        
        if (index === -1) return;
        
        const newIndex = index + direction;
        
        if (newIndex < 0 || newIndex >= floors.length) return;

        // Swap floors
        [floors[index], floors[newIndex]] = [floors[newIndex], floors[index]];

        // Save config
        await this.app.saveConfig();

        // Re-render floors
        await this.app.floorManager.renderFloors();

        console.log(`Moved floor ${direction > 0 ? 'down' : 'up'}`);
    }

    /**
     * Copy image file to floor directory
     */
    async copyImageToFloorDirectory(floorId, imageData) {
        try {
            // Get the homemapdata directory path
            const dataPath = await this.invoke('get_data_path');

            // Create floor directory: homemapdata/floors/<floor-id>/
            const floorDir = `${dataPath}/floors/${floorId}`;
            
            // Create directory
            await this.invoke('create_dir', { path: floorDir });

            // Generate a safe filename
            // On Android, the path might be a content URI or document ID, so we can't use it directly
            const timestamp = Date.now();
            const extension = this.getExtensionFromDataUrl(imageData.dataUrl) || 'png';
            const filename = `floor-image-${timestamp}.${extension}`;
            const targetPath = `${floorDir}/${filename}`;
            
            // Write the image data directly from the base64 dataUrl
            // This works for all platforms (desktop, Android content URIs, document IDs, etc.)
            const base64Data = imageData.dataUrl.split(',')[1]; // Remove data:image/xxx;base64, prefix
            await this.invoke('write_file_base64', { 
                filePath: targetPath,
                b64: base64Data
            });

            console.log('Saved image to:', targetPath);
            
            return filename;

        } catch (error) {
            console.error('Failed to copy image:', error);
            throw new Error('Failed to copy image file: ' + (error.message || error));
        }
    }

    /**
     * Get file extension from data URL
     */
    getExtensionFromDataUrl(dataUrl) {
        const match = dataUrl.match(/data:image\/(\w+);/);
        return match ? match[1] : null;
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
