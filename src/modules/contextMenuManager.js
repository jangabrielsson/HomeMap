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
        deviceEl.addEventListener('contextmenu', (e) => {
            console.log('Context menu triggered, editMode:', this.homeMap.editMode);
            if (!this.homeMap.editMode) {
                console.log('Not in edit mode, ignoring right-click');
                return; // Only show context menu in edit mode
            }
            
            e.preventDefault();
            console.log('Showing context menu at', e.clientX, e.clientY);
            this.showContextMenu(e.clientX, e.clientY, device);
        });
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
     * Show floor context menu (Edit Floor/Delete Floor/Add Floor)
     */
    showFloorContextMenu(x, y, floor) {
        const menu = document.getElementById('floorContextMenu');
        
        if (!menu) {
            console.error('Floor context menu element not found');
            return;
        }

        // Store floor reference
        this.floorContext = floor;

        const editFloorBtn = document.getElementById('floorContextMenuEdit');
        const deleteFloorBtn = document.getElementById('floorContextMenuDelete');
        const addFloorBtn = document.getElementById('floorContextMenuAdd');

        // Remove old listeners by cloning
        const newEditBtn = editFloorBtn.cloneNode(true);
        const newDeleteBtn = deleteFloorBtn.cloneNode(true);
        const newAddBtn = addFloorBtn.cloneNode(true);
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
