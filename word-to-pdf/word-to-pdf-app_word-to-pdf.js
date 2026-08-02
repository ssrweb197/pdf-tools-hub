/**
 * Word to PDF Converter Engine
 * Completely Client-Side Architecture for GitHub Pages / Static Hosting
 * Integrates: docx-preview, JSZip, html2canvas, jsPDF
 */

document.addEventListener('DOMContentLoaded', () => {
    // Core Elements & State Management
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const dropzoneState = document.getElementById('dropzoneState');
    const queueState = document.getElementById('queueState');
    const processingState = document.getElementById('processingState');
    const previewSection = document.getElementById('previewSection');

    const docxFileInput = document.getElementById('docxFileInput');
    const addMoreFileInput = document.getElementById('addMoreFileInput');
    const fileListTableBody = document.getElementById('fileListTableBody');
    const fileCountBadge = document.getElementById('fileCountBadge');
    
    const startConversionBtn = document.getElementById('startConversionBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    
    const docxPreviewTarget = document.getElementById('docxPreviewTarget');
    const previewDocTitle = document.getElementById('previewDocTitle');
    const offscreenRenderContainer = document.getElementById('offscreenRenderContainer');

    const processingStatusTitle = document.getElementById('processingStatusTitle');
    const processingStatusDetail = document.getElementById('processingStatusDetail');
    const globalProgressBar = document.getElementById('globalProgressBar');
    const currentProcessingFileName = document.getElementById('currentProcessingFileName');
    const processingPercentage = document.getElementById('processingPercentage');

    let fileQueue = []; // Holds file items: { id, file, name, size, status: 'ready'|'processing'|'completed'|'error', pdfBlobUrl }

    // --- Theme Toggle Logic ---
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', newTheme);
        themeIcon.className = newTheme === 'dark' ? 'bi bi-sun-fill text-warning fs-5' : 'bi bi-moon-stars-fill text-warning fs-5';
    });

    // --- Drag & Drop Event Handling ---
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzoneState.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneState.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzoneState.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzoneState.classList.remove('dragover');
        });
    });

    dropzoneState.addEventListener('drop', (e) => {
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.docx'));
        if (droppedFiles.length > 0) {
            addFilesToQueue(droppedFiles);
        } else {
            alert('Please select valid .docx Word files.');
        }
    });

    docxFileInput.addEventListener('change', (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length > 0) {
            addFilesToQueue(selectedFiles);
        }
        docxFileInput.value = '';
    });

    addMoreFileInput.addEventListener('change', (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length > 0) {
            addFilesToQueue(selectedFiles);
        }
        addMoreFileInput.value = '';
    });

    clearAllBtn.addEventListener('click', () => {
        fileQueue = [];
        renderQueueTable();
        switchUIState('dropzone');
        previewSection.classList.add('d-none');
    });

    closePreviewBtn.addEventListener('click', () => {
        previewSection.classList.add('d-none');
    });

    // --- Queue Management ---
    function addFilesToQueue(files) {
        files.forEach(file => {
            const fileObj = {
                id: 'doc_' + Math.random().toString(36).substring(2, 9),
                file: file,
                name: file.name,
                size: formatFileSize(file.size),
                status: 'ready',
                pdfBlobUrl: null
            };
            fileQueue.push(fileObj);
        });
        renderQueueTable();
        switchUIState('queue');
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function renderQueueTable() {
        fileListTableBody.innerHTML = '';
        fileCountBadge.textContent = fileQueue.length;

        if (fileQueue.length === 0) {
            switchUIState('dropzone');
            return;
        }

        fileQueue.forEach(item => {
            const tr = document.createElement('tr');
            
            let statusBadge = `<span class="badge bg-secondary-subtle text-secondary"><i class="bi bi-clock me-1"></i>Ready</span>`;
            if (item.status === 'processing') {
                statusBadge = `<span class="badge bg-primary-subtle text-primary"><i class="bi bi-gear-wide-connected me-1"></i>Converting...</span>`;
            } else if (item.status === 'completed') {
                statusBadge = `<span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle me-1"></i>Converted</span>`;
            } else if (item.status === 'error') {
                statusBadge = `<span class="badge bg-danger-subtle text-danger"><i class="bi bi-exclamation-triangle me-1"></i>Error</span>`;
            }

            let downloadOrPreviewActions = '';
            if (item.status === 'completed' && item.pdfBlobUrl) {
                downloadOrPreviewActions = `
                    <a href="${item.pdfBlobUrl}" download="${item.name.replace(/\.docx$/i, '')}.pdf" class="btn btn-sm btn-success rounded-pill px-3 me-1">
                        <i class="bi bi-download me-1"></i> Download
                    </a>
                `;
            }

            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-file-earmark-word text-primary fs-5"></i>
                        <span class="fw-semibold text-truncate" style="max-width: 280px;" title="${item.name}">${item.name}</span>
                    </div>
                </td>
                <td class="small text-muted">${item.size}</td>
                <td>${statusBadge}</td>
                <td class="text-end">
                    ${downloadOrPreviewActions}
                    <button class="btn btn-sm btn-outline-info rounded-circle me-1 preview-btn" data-id="${item.id}" title="Preview Document">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger rounded-circle remove-btn" data-id="${item.id}" title="Remove">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;

            fileListTableBody.appendChild(tr);
        });

        // Attach Row Event Listeners
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                previewDocument(id);
            });
        });

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                fileQueue = fileQueue.filter(item => item.id !== id);
                renderQueueTable();
            });
        });
    }

    function switchUIState(state) {
        dropzoneState.classList.add('d-none');
        queueState.classList.add('d-none');
        processingState.classList.add('d-none');

        if (state === 'dropzone') dropzoneState.classList.remove('d-none');
        if (state === 'queue') queueState.classList.remove('d-none');
        if (state === 'processing') processingState.classList.remove('d-none');
    }

    // --- Interactive Preview rendering using docx-preview ---
    async function previewDocument(id) {
        const item = fileQueue.find(i => i.id === id);
        if (!item) return;

        previewDocTitle.textContent = `Live previewing: ${item.name}`;
        previewSection.classList.remove('d-none');
        docxPreviewTarget.innerHTML = `<div class="text-center py-4 text-white"><div class="spinner-border spinner-border-sm me-2"></div> Rendering preview...</div>`;

        try {
            const arrayBuffer = await item.file.arrayBuffer();
            docxPreviewTarget.innerHTML = '';
            await window.docx.renderAsync(arrayBuffer, docxPreviewTarget, null, {
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
                experimental: true
            });
            previewSection.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            docxPreviewTarget.innerHTML = `<div class="alert alert-danger m-3">Failed to preview document: ${err.message}</div>`;
        }
    }

    // --- Core DOCX to PDF Conversion Processing Loop ---
    startConversionBtn.addEventListener('click', async () => {
        if (fileQueue.length === 0) return;

        switchUIState('processing');

        const totalItems = fileQueue.length;
        for (let i = 0; i < totalItems; i++) {
            const item = fileQueue[i];
            item.status = 'processing';
            currentProcessingFileName.textContent = item.name;
            updateProgressBar(0);

            try {
                processingStatusTitle.textContent = `Converting Document ${i + 1} of ${totalItems}`;
                processingStatusDetail.textContent = `Parsing DOCX structures & page breaks...`;

                const pdfBlob = await convertDocxToPdf(item.file, (percent, detail) => {
                    updateProgressBar(percent);
                    if (detail) processingStatusDetail.textContent = detail;
                });

                item.pdfBlobUrl = URL.createObjectURL(pdfBlob);
                item.status = 'completed';
            } catch (err) {
                console.error("Conversion Error:", err);
                item.status = 'error';
            }
        }

        switchUIState('queue');
        renderQueueTable();
    });

    function updateProgressBar(percentage) {
        const pct = Math.min(100, Math.max(0, Math.round(percentage)));
        globalProgressBar.style.width = `${pct}%`;
        processingPercentage.textContent = `${pct}%`;
    }

    /**
     * Converts DOCX file to PDF client-side using Canvas snapshotting and jsPDF
     * Handled in chunked asynchronous iterations to preserve UI responsiveness for large documents.
     */
    async function convertDocxToPdf(file, progressCallback) {
        const arrayBuffer = await file.arrayBuffer();
        
        // Step 1: Render DOCX to Offscreen Container DOM
        offscreenRenderContainer.innerHTML = '';
        progressCallback(10, "Rendering document structure into offscreen engine...");

        await window.docx.renderAsync(arrayBuffer, offscreenRenderContainer, null, {
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            experimental: true
        });

        // Give browser DOM a frame to compute image dimensions and layout geometry
        await new Promise(resolve => setTimeout(resolve, 300));

        // Locate document sections rendered by docx-preview
        const sections = offscreenRenderContainer.querySelectorAll('.docx-wrapper > section.docx');
        
        if (!sections || sections.length === 0) {
            throw new Error("Could not extract printable document sections from DOCX.");
        }

        // Initialize jsPDF (A4 format, standard mm dimensions)
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const totalSections = sections.length;

        for (let idx = 0; idx < totalSections; idx++) {
            const section = sections[idx];
            const currentPct = 10 + Math.round(((idx + 1) / totalSections) * 80);
            progressCallback(currentPct, `Capturing page section ${idx + 1} of ${totalSections}...`);

            // Use html2canvas to render DOM section to image canvas
            const canvas = await html2canvas(section, {
                scale: 2, // High DPI capture for sharp crisp text rendering
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            // Handle section content spanning across continuous pages
            let heightLeft = imgHeight;
            let position = 0;

            if (idx > 0) {
                pdf.addPage();
            }

            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            // Loop for long documents where single section exceeds 1 page
            while (heightLeft > 2) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            // Clean memory reference between loops
            canvas.width = 0;
            canvas.height = 0;
        }

        progressCallback(98, "Finalizing PDF file stream...");
        // Cleanup offscreen sandbox
        offscreenRenderContainer.innerHTML = '';

        return pdf.output('blob');
    }
});
