$(document).ready(async function() {
    if (!AdminStore.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const $status = $('#statusMessage');
    let cloudReviewUnsubscribe = null;

    await AdminStore.syncFromCloud();
    loadProductOptions();
    loadReviews();
    setupEvents();
    startLiveReviewListener();

    function compressImageFile(file, maxDimension = 900, quality = 0.72) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error('Invalid image file'));
                img.onload = () => {
                    const ratio = Math.min(1, maxDimension / Math.max(img.width, img.height));
                    const width = Math.max(1, Math.round(img.width * ratio));
                    const height = Math.max(1, Math.round(img.height * ratio));

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let q = quality;
                    let output = canvas.toDataURL('image/jpeg', q);
                    while (output.length > 220000 && q > 0.45) {
                        q -= 0.07;
                        output = canvas.toDataURL('image/jpeg', q);
                    }
                    resolve(output);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getProductsMap() {
        const map = {};
        AdminStore.getProducts().forEach(product => {
            map[String(product.id)] = product;
        });
        return map;
    }

    function getStars(rating) {
        const r = Math.max(1, Math.min(5, Number(rating || 0)));
        return '★'.repeat(r) + '☆'.repeat(5 - r);
    }

    function formatDate(ts) {
        const date = new Date(Number(ts || Date.now()));
        return date.toLocaleString();
    }

    function getReviewImages() {
        try {
            const parsed = JSON.parse($('#reviewImages').val() || '[]');
            return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (err) {
            return [];
        }
    }

    function setReviewImages(images) {
        $('#reviewImages').val(JSON.stringify(Array.isArray(images) ? images : []));
        renderReviewImagePreview();
    }

    function renderReviewImagePreview() {
        const images = getReviewImages();
        const $preview = $('#reviewImagePreview');
        if (!images.length) {
            $preview.hide().empty();
            return;
        }

        const html = images.map((src, idx) => `
            <div style="position: relative;">
                <img src="${src}" alt="Review ${idx + 1}">
                <button type="button" class="btn btn-sm btn-danger remove-review-image" data-index="${idx}" style="position:absolute;top:-8px;right:-8px;line-height:1;padding:1px 6px;">&times;</button>
            </div>
        `).join('');

        $preview.html(html).css('display', 'flex');
    }

    function loadProductOptions() {
        const products = AdminStore.getProducts().filter(p => p.isActive !== false);
        const options = ['<option value="">Select product</option>']
            .concat(products.map(p => `<option value="${p.id}">${escapeHtml(p.name || 'Product')}</option>`));
        $('#reviewProductId').html(options.join(''));
    }

    function renderReviewCard(review, productsMap, allowActions) {
        const product = productsMap[String(review.productId)] || {};
        const images = Array.isArray(review.images) ? review.images : [];
        const statusClass = review.status === 'approved' ? 'badge-approved' : review.status === 'rejected' ? 'badge-rejected' : 'badge-pending';

        return `
            <div class="review-card">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <strong>${escapeHtml(review.authorName || 'Anonymous')}</strong>
                    <span class="badge ${statusClass}">${escapeHtml(review.status || 'pending')}</span>
                </div>
                <div class="review-meta">
                    Product: <strong>${escapeHtml(product.name || 'Unknown Product')}</strong> | ${escapeHtml(formatDate(review.createdAt))} | Source: ${escapeHtml(review.source || 'customer')}
                </div>
                <div class="review-stars">${getStars(review.rating)}</div>
                <div class="mt-1">${escapeHtml(review.text || '')}</div>
                ${images.length ? `<div class="review-images">${images.map(src => `<img src="${src}" alt="Review image">`).join('')}</div>` : ''}
                ${allowActions ? `
                    <div class="mt-3">
                        <button class="btn btn-success btn-sm approve-review" data-id="${review.id}"><i class="fas fa-check"></i> Approve</button>
                        <button class="btn btn-outline-danger btn-sm reject-review" data-id="${review.id}"><i class="fas fa-times"></i> Reject</button>
                        <button class="btn btn-outline-secondary btn-sm delete-review" data-id="${review.id}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function loadReviews() {
        const reviews = AdminStore.getReviews().slice().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        const productsMap = getProductsMap();

        const pending = reviews.filter(r => String(r.status) === 'pending');
        const approved = reviews.filter(r => String(r.status) === 'approved');

        $('#pendingCount').text(pending.length);

        if (!pending.length) {
            $('#pendingReviewsList').html('<div class="text-muted">No pending customer reviews.</div>');
        } else {
            $('#pendingReviewsList').html(pending.map(r => renderReviewCard(r, productsMap, true)).join(''));
        }

        if (!approved.length) {
            $('#approvedReviewsList').html('<div class="text-muted">No approved reviews yet.</div>');
        } else {
            $('#approvedReviewsList').html(approved.map(r => renderReviewCard(r, productsMap, true)).join(''));
        }
    }

    async function startLiveReviewListener() {
        try {
            const ready = await AdminStore.ensureCloudReady();
            if (!ready || cloudReviewUnsubscribe) return;

            const ref = AdminStore.getCloudDocRef();
            if (!ref) return;

            cloudReviewUnsubscribe = ref.onSnapshot((snap) => {
                if (!snap || !snap.exists) return;

                const payload = snap.data() || {};
                const cloudStore = AdminStore.normalizeStoreShape(payload.store || {});
                localStorage.setItem(AdminStore.STORE_KEY, JSON.stringify(cloudStore));
                loadProductOptions();
                loadReviews();
            }, (err) => {
                console.warn('Live review listener failed.', err);
            });
        } catch (err) {
            console.warn('Unable to start live review listener.', err);
        }
    }

    function setupEvents() {
        $(document).on('click', '#uploadReviewImagesBtn', async function() {
            const input = document.getElementById('reviewImageFiles');
            const files = input && input.files ? Array.from(input.files) : [];
            if (!files.length) {
                showStatus('Please select image files first.', 'warning');
                return;
            }

            const current = getReviewImages();
            const uploaded = [];

            for (const file of files) {
                try {
                    const data = await compressImageFile(file);
                    uploaded.push(data);
                } catch (err) {
                    console.warn('Skipping invalid review image file', err);
                }
            }

            setReviewImages(current.concat(uploaded));
            if (input) input.value = '';
            showStatus('Review images uploaded.', 'success');
        });

        $(document).on('click', '.remove-review-image', function() {
            const idx = parseInt($(this).data('index'), 10);
            const images = getReviewImages();
            if (Number.isInteger(idx) && idx >= 0 && idx < images.length) {
                images.splice(idx, 1);
                setReviewImages(images);
            }
        });

        $('#adminReviewForm').on('submit', function(e) {
            e.preventDefault();

            const productId = String($('#reviewProductId').val() || '').trim();
            const authorName = String($('#reviewAuthor').val() || '').trim();
            const text = String($('#reviewText').val() || '').trim();
            const rating = Number($('#reviewRating').val() || 5);
            const images = getReviewImages();

            if (!productId || !authorName || !text) {
                showStatus('Product, customer name, and review text are required.', 'danger');
                return;
            }

            AdminStore.addReview({
                productId,
                authorName,
                rating,
                text,
                images,
                status: 'approved',
                source: 'admin'
            });

            this.reset();
            setReviewImages([]);
            loadReviews();
            showStatus('Review published successfully.', 'success');
        });

        $(document).on('click', '.approve-review', function() {
            const id = $(this).data('id');
            AdminStore.updateReview(id, { status: 'approved' });
            loadReviews();
            showStatus('Review approved.', 'success');
        });

        $(document).on('click', '.reject-review', function() {
            const id = $(this).data('id');
            AdminStore.updateReview(id, { status: 'rejected' });
            loadReviews();
            showStatus('Review rejected.', 'info');
        });

        $(document).on('click', '.delete-review', function() {
            const id = $(this).data('id');
            if (!confirm('Delete this review permanently?')) return;
            AdminStore.deleteReview(id);
            loadReviews();
            showStatus('Review deleted.', 'info');
        });

        $(document).on('click', '#logoutBtn', function() {
            if (confirm('Logout from admin panel?')) {
                AdminStore.clearSession();
                window.location.href = 'login.html';
            }
        });

        window.addEventListener('storage', function(event) {
            if (event.key === AdminStore.STORE_KEY) {
                loadProductOptions();
                loadReviews();
            }
        });
    }

    function showStatus(message, type) {
        $status
            .removeClass('d-none')
            .removeClass('alert-success alert-danger alert-info alert-warning')
            .addClass('alert-' + type)
            .text(message)
            .fadeIn();

        if (type === 'success' || type === 'info') {
            setTimeout(() => $status.fadeOut().addClass('d-none'), 2500);
        }
    }
});
