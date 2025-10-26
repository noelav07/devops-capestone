// Modern CloudDrive S3 File Manager
class CloudDrive {
    constructor() {
        this.selectedFiles = [];
        this.currentView = 'grid';
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.statusMessages = document.getElementById('statusMessages');
        this.filesContainer = document.getElementById('filesContainer');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.loadingFiles = document.getElementById('loadingFiles');
        this.selectedFilesContainer = document.getElementById('selectedFiles');
        this.uploadControls = document.getElementById('uploadControls');
        
        this.initializeEventListeners();
        this.loadFiles();
    }
    
    initializeEventListeners() {
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        
        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Button events
        this.uploadBtn.addEventListener('click', () => this.uploadFiles());
        this.clearBtn.addEventListener('click', () => this.clearFiles());
        this.refreshBtn.addEventListener('click', () => this.loadFiles());
        
        // View controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e.target.dataset.view));
        });
    }
    
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        this.addFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
    }
    
    addFiles(files) {
        files.forEach(file => {
            if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.selectedFiles.push(file);
            }
        });
        this.updateFileList();
        this.updateUploadButton();
    }
    
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileList();
        this.updateUploadButton();
    }
    
    updateFileList() {
        this.fileList.innerHTML = '';
        
        if (this.selectedFiles.length === 0) {
            this.selectedFilesContainer.style.display = 'none';
            this.uploadControls.style.display = 'none';
            return;
        }
        
        this.selectedFilesContainer.style.display = 'block';
        this.uploadControls.style.display = 'flex';
        
        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileIcon = this.getFileIcon(file.type);
            const fileSize = this.formatFileSize(file.size);
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                </div>
                <button class="file-remove" onclick="cloudDrive.removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            this.fileList.appendChild(fileItem);
        });
    }
    
    updateUploadButton() {
        this.uploadBtn.disabled = this.selectedFiles.length === 0;
    }
    
    getFileIcon(fileType) {
        if (fileType.startsWith('image/')) return '<i class="fas fa-image"></i>';
        if (fileType.startsWith('video/')) return '<i class="fas fa-video"></i>';
        if (fileType.startsWith('audio/')) return '<i class="fas fa-music"></i>';
        if (fileType.includes('pdf')) return '<i class="fas fa-file-pdf"></i>';
        if (fileType.includes('word')) return '<i class="fas fa-file-word"></i>';
        if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '<i class="fas fa-file-excel"></i>';
        if (fileType.includes('zip') || fileType.includes('rar')) return '<i class="fas fa-file-archive"></i>';
        if (fileType.includes('text')) return '<i class="fas fa-file-alt"></i>';
        return '<i class="fas fa-file"></i>';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    clearFiles() {
        this.selectedFiles = [];
        this.fileInput.value = '';
        this.updateFileList();
        this.updateUploadButton();
        this.hideProgress();
        this.clearStatusMessages();
    }
    
    async uploadFiles() {
        if (this.selectedFiles.length === 0) return;
        
        this.showProgress();
        this.clearStatusMessages();
        
        try {
            // Step 1: Get presigned URLs from server
            const presignedResponse = await fetch('http://localhost:3000/generate-presigned-urls', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: this.selectedFiles.map(file => ({
                        name: file.name,
                        type: file.type,
                        size: file.size
                    }))
                })
            });
            
            const presignedResult = await presignedResponse.json();
            
            if (!presignedResponse.ok) {
                throw new Error(presignedResult.error);
            }
            
            // Step 2: Upload files directly to S3 using presigned URLs
            const uploadedFiles = [];
            const totalFiles = this.selectedFiles.length;
            
            for (let i = 0; i < this.selectedFiles.length; i++) {
                const file = this.selectedFiles[i];
                const presignedData = presignedResult.presignedData[i];
                
                try {
                    // Update progress
                    const progress = ((i + 1) / totalFiles) * 100;
                    this.updateProgress(progress);
                    
                    // Upload directly to S3
                    const s3Response = await fetch(presignedData.presignedUrl, {
                        method: 'PUT',
                        body: file,
                        headers: {
                            'Content-Type': file.type
                        }
                    });
                    
                    if (s3Response.ok) {
                        // Confirm upload with server
                        const confirmResponse = await fetch('http://localhost:3000/confirm-upload', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                s3Key: presignedData.s3Key,
                                originalName: presignedData.originalName,
                                fileName: presignedData.fileName,
                                size: presignedData.size,
                                type: presignedData.type
                            })
                        });
                        
                        const confirmResult = await confirmResponse.json();
                        uploadedFiles.push(confirmResult.uploadedFile);
                    } else {
                        throw new Error(`S3 upload failed for ${file.name}`);
                    }
                } catch (error) {
                    throw new Error(`Failed to upload ${file.name}: ${error.message}`);
                }
            }
            
            this.showStatusMessage('Files uploaded successfully!', 'success');
            this.showUploadedFiles(uploadedFiles);
            this.clearFiles();
            this.loadFiles(); // Refresh the file list
            
        } catch (error) {
            this.showStatusMessage(`Upload error: ${error.message}`, 'error');
        } finally {
            this.hideProgress();
        }
    }
    
    updateProgress(percentage) {
        this.progressFill.style.width = percentage + '%';
        this.progressText.textContent = Math.round(percentage) + '%';
    }
    
    showProgress() {
        this.progressSection.style.display = 'block';
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '0%';
    }
    
    hideProgress() {
        setTimeout(() => {
            this.progressSection.style.display = 'none';
        }, 1000);
    }
    
    showUploadedFiles(uploadedFiles) {
        if (uploadedFiles && uploadedFiles.length > 0) {
            const fileList = uploadedFiles.map(file => 
                `<a href="${file.url}" target="_blank" style="color: var(--success-600); text-decoration: none;">${file.originalName}</a>`
            ).join(', ');
            this.showStatusMessage(`Uploaded files: ${fileList}`, 'info');
        }
    }
    
    showStatusMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `status-message status-${type}`;
        messageDiv.textContent = message;
        this.statusMessages.appendChild(messageDiv);
        
        // Auto-remove success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 5000);
        }
    }
    
    clearStatusMessages() {
        this.statusMessages.innerHTML = '';
    }
    
    // File listing and download functionality
    async loadFiles() {
        this.showLoading();
        
        try {
            const response = await fetch('http://localhost:3000/list-files');
            const result = await response.json();
            
            if (response.ok) {
                this.displayFiles(result.files);
            } else {
                this.showFileError(`Failed to load files: ${result.error}`);
            }
        } catch (error) {
            this.showFileError(`Error loading files: ${error.message}`);
        }
    }
    
    displayFiles(files) {
        this.filesContainer.innerHTML = '';
        
        if (files.length === 0) {
            this.filesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📁</div>
                    <div class="empty-state-text">No files found</div>
                    <div class="empty-state-subtext">Upload some files to get started!</div>
                </div>
            `;
            return;
        }
        
        const container = document.createElement('div');
        container.className = this.currentView === 'grid' ? 'files-grid' : 'files-list';
        
        files.forEach(file => {
            const fileCard = document.createElement('div');
            fileCard.className = 'file-card';
            fileCard.onclick = () => this.previewFile(file);
            
            const fileIcon = this.getFileIcon(file.fileName);
            const fileSize = this.formatFileSize(file.size);
            const lastModified = new Date(file.lastModified).toLocaleDateString();
            
            fileCard.innerHTML = `
                <div class="file-card-header">
                    <div class="file-card-icon">${fileIcon}</div>
                    <div class="file-card-info">
                        <div class="file-card-name">${file.fileName}</div>
                        <div class="file-card-meta">
                            <span>📏 ${fileSize}</span>
                            <span>📅 ${lastModified}</span>
                        </div>
                    </div>
                </div>
                <div class="file-card-actions">
                    <button class="action-btn download-btn" onclick="event.stopPropagation(); cloudDrive.downloadFile('${file.key}', '${file.fileName}')">
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                    <button class="action-btn delete-btn" onclick="event.stopPropagation(); cloudDrive.deleteFile('${file.key}', '${file.fileName}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            `;
            
            container.appendChild(fileCard);
        });
        
        this.filesContainer.appendChild(container);
    }
    
    previewFile(file) {
        const modal = document.getElementById('fileModal');
        const modalFileName = document.getElementById('modalFileName');
        const modalBody = document.getElementById('modalBody');
        const modalDownloadBtn = document.getElementById('modalDownloadBtn');
        
        modalFileName.textContent = file.fileName;
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">${this.getFileIcon(file.fileName)}</div>
                <h3 style="margin-bottom: 1rem;">${file.fileName}</h3>
                <p style="color: var(--gray-600); margin-bottom: 0.5rem;">Size: ${this.formatFileSize(file.size)}</p>
                <p style="color: var(--gray-600);">Uploaded: ${new Date(file.lastModified).toLocaleDateString()}</p>
            </div>
        `;
        
        modalDownloadBtn.onclick = () => this.downloadFile(file.key, file.fileName);
        modal.style.display = 'flex';
    }
    
    async downloadFile(key, fileName) {
        try {
            this.showStatusMessage(`Generating download link for ${fileName}...`, 'info');
            
            const response = await fetch('http://localhost:3000/download-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Create a temporary link and trigger download
                const link = document.createElement('a');
                link.href = result.downloadUrl;
                link.download = fileName;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showStatusMessage(`Download started for ${fileName}`, 'success');
            } else {
                this.showStatusMessage(`Download failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showStatusMessage(`Download error: ${error.message}`, 'error');
        }
    }
    
    async deleteFile(key, fileName) {
        if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            this.showStatusMessage(`Deleting ${fileName}...`, 'info');
            
            const response = await fetch('http://localhost:3000/delete-file', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showStatusMessage(`Successfully deleted ${fileName}`, 'success');
                this.loadFiles(); // Refresh the file list
            } else {
                this.showStatusMessage(`Delete failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showStatusMessage(`Delete error: ${error.message}`, 'error');
        }
    }
    
    toggleView(view) {
        this.currentView = view;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        // Reload files with new view
        this.loadFiles();
    }
    
    showLoading() {
        this.loadingFiles.style.display = 'block';
        this.filesContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading your files...</p></div>';
    }
    
    showFileError(message) {
        this.filesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Error loading files</div>
                <div class="empty-state-subtext">${message}</div>
            </div>
        `;
    }
}

// Modal functions
function closeModal() {
    document.getElementById('fileModal').style.display = 'none';
}

// Initialize the application when the page loads
let cloudDrive;
document.addEventListener('DOMContentLoaded', () => {
    cloudDrive = new CloudDrive();
});
