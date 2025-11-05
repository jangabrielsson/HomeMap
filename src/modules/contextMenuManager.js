// Context menu management for devices

export class ContextMenuManager {
    constructor(homeMap) {
        this.homeMap = homeMap;
        this.contextMenuDevice = null;
        this.addDeviceContext = null;
        this.floorContext = null;
    }

    /**
     * Setup context menu for a device element
     */
    setupDeviceContextMenu(deviceEl, device) {
        // Desktop: Right-click
        deviceEl.addEventListener('contextmenu', (e) => {
            console.log('Context menu triggered (right-click), editMode:', this.homeMap.editMode);
            if (!this.homeMap.editMode) {
                console.log('Not in edit mode, ignoring right-click');
                return; // Only show context menu in edit mode
            }
            
            e.preventDefault();
            console.log('Showing context menu at', e.clientX, e.clientY);
            this.showContextMenu(e.clientX, e.clientY, device);
        });

        // Mobile: Long press
        this.setupLongPressContextMenu(deviceEl, device);
    }

    /**
     * Setup long-press context menu for touch devices
     */
    setupLongPressContextMenu(deviceEl, device) {
        let pressTimer = null;
        let startPos = { x: 0, y: 0 };
        const longPressDelay = 500; // 500ms for long press
        const moveThreshold = 10; // pixels - if user moves more than this, cancel long press

        // Touch start - begin long press detection
        deviceEl.addEventListener('touchstart', (e) => {
            if (!this.homeMap.editMode) {
                return; // Only in edit mode
            }

            const touch = e.touches[0];
            startPos = { x: touch.clientX, y: touch.clientY };

            // Clear any existing timer
            if (pressTimer) {
                clearTimeout(pressTimer);
            }

            // Start long press timer
            pressTimer = setTimeout(() => {
                console.log('Long press detected on device');
                e.preventDefault();
                
                // Provide haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50); // Short vibration
                }
                
                this.showContextMenu(startPos.x, startPos.y, device);
                pressTimer = null;
            }, longPressDelay);
        }, { passive: false });

        // Touch move - cancel long press if moved too much
        deviceEl.addEventListener('touchmove', (e) => {
            if (pressTimer && this.homeMap.editMode) {
                const touch = e.touches[0];
                const deltaX = Math.abs(touch.clientX - startPos.x);
                const deltaY = Math.abs(touch.clientY - startPos.y);

                if (deltaX > moveThreshold || deltaY > moveThreshold) {
                    console.log('Touch moved too much, canceling long press');
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            }
        }, { passive: true });

        // Touch end/cancel - clear timer
        const clearPressTimer = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        deviceEl.addEventListener('touchend', clearPressTimer, { passive: true });
        deviceEl.addEventListener('touchcancel', clearPressTimer, { passive: true });
    }

    /**
     * Setup context menu for floor (both right-click and long-press)
     */
    setupFloorContextMenu(floorEl, floor) {
        // Desktop: Right-click
        floorEl.addEventListener('contextmenu', (e) => {
            if (!this.homeMap.editMode) return; // Only in edit mode
            
            // Check if we clicked on empty space (not on a device)
            if (e.target.closest('.device')) {
                return; // Device will handle its own context menu
            }
            
            e.preventDefault();
            console.log('Floor context menu triggered (right-click)');
            
            // Calculate relative position on the floor image for device placement
            const floorImage = floorEl.querySelector('.floor-image');
            if (floorImage) {
                const rect = floorImage.getBoundingClientRect();
                const relativeX = ((e.clientX - rect.left) / rect.width) * floorImage.naturalWidth;
                const relativeY = ((e.clientY - rect.top) / rect.height) * floorImage.naturalHeight;
                
                this.showFloorContextMenu(e.clientX, e.clientY, floor, { x: relativeX, y: relativeY });
            } else {
                this.showFloorContextMenu(e.clientX, e.clientY, floor);
            }
        });

        // Mobile: Long press (only on empty areas, not devices)
        this.setupFloorLongPress(floorEl, floor);
    }

    /**
     * Setup long-press for floor context menu
     */
    setupFloorLongPress(floorEl, floor) {
        let pressTimer = null;
        let startPos = { x: 0, y: 0 };
        const longPressDelay = 600; // Slightly longer for floor (600ms)
        const moveThreshold = 15; // Slightly larger threshold for floor

        floorEl.addEventListener('touchstart', (e) => {
            if (!this.homeMap.editMode) return;

            // Check if touch started on a device - if so, let device handle it
            if (e.target.closest('.device')) {
                return;
            }

            const touch = e.touches[0];
            startPos = { x: touch.clientX, y: touch.clientY };

            if (pressTimer) {
                clearTimeout(pressTimer);
            }

            pressTimer = setTimeout(() => {
                console.log('Long press detected on floor');
                e.preventDefault();
                
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                // Calculate relative position on the floor image for device placement
                const floorImage = floorEl.querySelector('.floor-image');
                if (floorImage) {
                    const rect = floorImage.getBoundingClientRect();
                    const relativeX = ((startPos.x - rect.left) / rect.width) * floorImage.naturalWidth;
                    const relativeY = ((startPos.y - rect.top) / rect.height) * floorImage.naturalHeight;
                    
                    this.showFloorContextMenu(startPos.x, startPos.y, floor, { x: relativeX, y: relativeY });
                } else {
                    this.showFloorContextMenu(startPos.x, startPos.y, floor);
                }
                pressTimer = null;
            }, longPressDelay);
        }, { passive: false });

        floorEl.addEventListener('touchmove', (e) => {
            if (pressTimer && this.homeMap.editMode) {
                const touch = e.touches[0];
                const deltaX = Math.abs(touch.clientX - startPos.x);
                const deltaY = Math.abs(touch.clientY - startPos.y);

                if (deltaX > moveThreshold || deltaY > moveThreshold) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            }
        }, { passive: true });

        const clearFloorPressTimer = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        floorEl.addEventListener('touchend', clearFloorPressTimer, { passive: true });
        floorEl.addEventListener('touchcancel', clearFloorPressTimer, { passive: true });
    }

    /**
     * Show device context menu (Edit/Delete)
     */
    showContextMenu(x, y, device) {
        const contextMenu = document.getElementById('contextMenu');
        
        // Store device reference for Edit/Delete actions
        this.contextMenuDevice = device;
        
        // Setup Edit and Delete handlers
        const editBtn = document.getElementById('contextMenuEdit');
        const deleteBtn = document.getElementById('contextMenuDelete');
        
        // Remove old listeners by cloning
        const newEditBtn = editBtn.cloneNode(true);
        const newDeleteBtn = deleteBtn.cloneNode(true);
        editBtn.replaceWith(newEditBtn);
        deleteBtn.replaceWith(newDeleteBtn);
        
        newEditBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.homeMap.dialogManager.showEditDeviceDialog(device);
        });
        
        newDeleteBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.homeMap.dialogManager.showDeleteDeviceDialog(device);
        });
        
        // Position the menu
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.display = 'block';
        
        // Hide menu when clicking elsewhere
        const hideOnClick = (e) => {
            // Ignore Ctrl+Click on macOS (which triggers context menu)
            if (e.ctrlKey) return;
            
            if (!contextMenu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', hideOnClick);
            }
        };
        
        // Delay to avoid immediate close
        setTimeout(() => {
            document.addEventListener('click', hideOnClick);
        }, 10);
    }

    /**
     * Hide all context menus
     */
    hideContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'none';
        
        const addDeviceMenu = document.getElementById('addDeviceMenu');
        if (addDeviceMenu) {
            addDeviceMenu.style.display = 'none';
        }

        const floorMenu = document.getElementById('floorContextMenu');
        if (floorMenu) {
            floorMenu.style.display = 'none';
        }
    }

    /**
     * Show "Add Device" menu
     */
    showAddDeviceMenu(x, y, floorId, position) {
        const menu = document.getElementById('addDeviceMenu');
        
        // Store context for the add dialog
        this.addDeviceContext = { floorId, position };
        
        const addBtn = document.getElementById('addDeviceMenuItem');
        
        // Remove old listener
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.replaceWith(newAddBtn);
        
        newAddBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.homeMap.dialogManager.showAddDeviceDialog(floorId, position);
        });
        
        // Position the menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
        
        // Hide menu when clicking elsewhere
        const hideOnClick = (e) => {
            // Ignore Ctrl+Click on macOS (which triggers context menu)
            if (e.ctrlKey) return;
            
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', hideOnClick);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', hideOnClick);
        }, 10);
    }

    /**
     * Show floor context menu (Add Device/Edit Floor/Delete Floor/Add Floor)
     */
    showFloorContextMenu(x, y, floor, position = null) {
        const menu = document.getElementById('floorContextMenu');
        
        if (!menu) {
            console.error('Floor context menu element not found');
            return;
        }

        // Store floor reference and position for device addition
        this.floorContext = floor;
        this.floorClickPosition = position;

        const addDeviceBtn = document.getElementById('floorContextMenuAddDevice');
        const editFloorBtn = document.getElementById('floorContextMenuEdit');
        const deleteFloorBtn = document.getElementById('floorContextMenuDelete');
        const addFloorBtn = document.getElementById('floorContextMenuAdd');

        // Remove old listeners by cloning
        const newAddDeviceBtn = addDeviceBtn.cloneNode(true);
        const newEditBtn = editFloorBtn.cloneNode(true);
        const newDeleteBtn = deleteFloorBtn.cloneNode(true);
        const newAddBtn = addFloorBtn.cloneNode(true);
        addDeviceBtn.replaceWith(newAddDeviceBtn);
        editFloorBtn.replaceWith(newEditBtn);
        deleteFloorBtn.replaceWith(newDeleteBtn);
        addFloorBtn.replaceWith(newAddBtn);

        // Disable delete button if this is the last floor
        const isLastFloor = this.homeMap.homemapConfig.floors.length <= 1;
        if (isLastFloor) {
            newDeleteBtn.style.opacity = '0.5';
            newDeleteBtn.style.cursor = 'not-allowed';
            newDeleteBtn.title = 'Cannot delete the last floor';
        }

        newAddDeviceBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.homeMap.dialogManager.showAddDeviceDialog(floor.id, this.floorClickPosition);
        });

        newEditBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.homeMap.floorManagementDialog.showEditFloorDialog(floor);
        });

        newDeleteBtn.addEventListener('click', () => {
            this.hideContextMenu();
            if (!isLastFloor) {
                this.homeMap.floorManagementDialog.deleteFloor(floor);
            }
        });

        newAddBtn.addEventListener('click', () => {
            this.hideContextMenu();
            this.homeMap.floorManagementDialog.showAddFloorDialog();
        });

        // Position the menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';

        // Hide menu when clicking elsewhere
        const hideOnClick = (e) => {
            if (e.ctrlKey) return;
            
            if (!menu.contains(e.target)) {
                this.hideFloorContextMenu();
                document.removeEventListener('click', hideOnClick);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', hideOnClick);
        }, 10);
    }

    /**
     * Hide floor context menu
     */
    hideFloorContextMenu() {
        const menu = document.getElementById('floorContextMenu');
        if (menu) {
            menu.style.display = 'none';
        }
    }
}
