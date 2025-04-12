document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const addTokenForm = document.getElementById('add-token-form');
    const tokensTbody = document.getElementById('tokens-tbody');
    const refreshButton = document.getElementById('refresh-tokens');
    const addStatus = document.getElementById('add-status');
    const listStatus = document.getElementById('list-status');
    const headerSelectAllCheckbox = document.getElementById('header-select-all');
    const toolbarSelectAllCheckbox = document.getElementById('select-all-tokens'); // Toolbar checkbox
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const checkSelectedBtn = document.getElementById('check-selected-btn'); // Enable this
    // const exportSelectedBtn = document.getElementById('export-selected-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfoSpan = document.getElementById('page-info');
    const itemsPerPageSelect = document.getElementById('items-per-page');


    const API_BASE_URL = '/api'; // Relative path to our backend API

    // State Variables
    let allTokens = []; // Cache for all fetched tokens
    let selectedTokenIds = new Set();
    let currentPage = 1;
    let itemsPerPage = parseInt(itemsPerPageSelect.value, 10);
    let totalPages = 1;

    // --- Helper Functions ---
    const showMessage = (element, message, isError = false) => {
        element.textContent = message;
        element.style.color = isError ? 'red' : 'green';
        setTimeout(() => { element.textContent = ''; }, 5000); // Clear after 5s
    };

    const formatKey = (key) => {
        if (!key || key.length < 8) return key;
        return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const renderStatus = (status) => {
        const statusText = status || 'unknown';
        const className = `status-${statusText.toLowerCase()}`;
        // Apply base badge class and specific status class
        return `<span class="status-badge ${className}">${statusText}</span>`;
    }

    // --- API Calls ---
    const fetchTokens = async () => {
        listStatus.textContent = 'Loading tokens...';
        try {
            const response = await fetch(`${API_BASE_URL}/keys`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const tokens = await response.json();
            // --- Start of Corrected Success Logic ---
            allTokens = tokens; // Store all tokens
            currentPage = 1; // Reset to first page on refresh
            updatePagination();
            renderTokensPage(); // Render the first page
            listStatus.textContent = ''; // Clear loading message
            updateToolbar(); // Update button states
            // --- End of Corrected Success Logic ---
        } catch (error) {
            console.error('Error fetching tokens:', error);
            showMessage(listStatus, `Error fetching tokens: ${error.message}`, true);
            allTokens = []; // Clear cache on error
            renderTokensPage(); // Render empty state
            updateToolbar();
        }
    };

    const addToken = async (event) => {
        event.preventDefault();
        addStatus.textContent = 'Adding token...';
        const formData = new FormData(addTokenForm);
        const tokenData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`${API_BASE_URL}/keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tokenData),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            showMessage(addStatus, `Token "${result.name}" added successfully!`);
            addTokenForm.reset();
            fetchTokens(); // Refresh the list
        } catch (error) {
            console.error('Error adding token:', error);
            showMessage(addStatus, `Error adding token: ${error.message}`, true);
        }
    };

    const deleteToken = async (id, name) => {
        if (!confirm(`Are you sure you want to delete token "${name}" (ID: ${id})?`)) {
            return;
        }
        listStatus.textContent = `Deleting token ${name}...`;
        try {
            const response = await fetch(`${API_BASE_URL}/keys/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                 // Try to parse error if available
                 let errorMsg = `HTTP error! status: ${response.status}`;
                 try {
                     const errResult = await response.json();
                     errorMsg = errResult.error || errorMsg;
                 } catch (e) { /* Ignore parsing error */ }
                 throw new Error(errorMsg);
            }
            // No content expected on success (204)
            showMessage(listStatus, `Token "${name}" deleted successfully.`);
            fetchTokens(); // Refresh the list
        } catch (error) {
            console.error('Error deleting token:', error);
            showMessage(listStatus, `Error deleting token: ${error.message}`, true);
        }
    };

    // Batch Delete (Client-side loop for now)
    const deleteSelectedTokens = async () => {
        const idsToDelete = Array.from(selectedTokenIds);
        if (idsToDelete.length === 0) {
            showMessage(listStatus, 'No tokens selected for deletion.', true);
            return;
        }
        if (!confirm(`Are you sure you want to delete ${idsToDelete.length} selected token(s)?`)) {
            return;
        }

        listStatus.textContent = `Deleting ${idsToDelete.length} token(s)...`;
        let successCount = 0;
        let errorCount = 0;

        // TODO: Replace this loop with a single batch API call when backend supports it
        for (const id of idsToDelete) {
            try {
                const response = await fetch(`${API_BASE_URL}/keys/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    successCount++;
                    selectedTokenIds.delete(id); // Remove from selection on success
                } else {
                    errorCount++;
                    // Log specific error?
                    console.warn(`Failed to delete token ${id}, status: ${response.status}`);
                }
            } catch (error) {
                errorCount++;
                console.error(`Error deleting token ${id}:`, error);
            }
        }

        let message = `Batch delete finished. ${successCount} deleted successfully.`;
        if (errorCount > 0) {
            message += ` ${errorCount} failed.`;
        }
        showMessage(listStatus, message, errorCount > 0);
        fetchTokens(); // Refresh the list
    };

    // Check Token Status (Single)
    const checkTokenStatus = async (id, type, buttonElement) => {
        const originalButtonText = buttonElement.textContent;
        buttonElement.textContent = 'Checking...';
        buttonElement.disabled = true;
        listStatus.textContent = `Checking status for token ${id}...`;

        try {
            const response = await fetch(`${API_BASE_URL}/test-proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenId: id, type: type }),
            });
            const result = await response.json();

            if (!response.ok) {
                 throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            // Show success/failure message briefly
            const message = `Token ${id} (${type}): ${result.success ? 'OK' : 'FAIL'} (Status: ${result.status}, ${result.durationMs}ms)`;
            showMessage(listStatus, message, !result.success);

            // Find the row and update status visually immediately (optional, fetchTokens will do it too)
            const row = buttonElement.closest('tr');
            if (row) {
                const statusCell = row.cells[4]; // Assuming status is the 5th cell (index 4)
                const checkedCell = row.cells[5]; // Assuming lastChecked is the 6th cell (index 5)
                if (statusCell) statusCell.innerHTML = renderStatus(result.success ? 'valid' : `error_${result.status}`);
                if (checkedCell) checkedCell.textContent = formatDate(new Date().toISOString()); // Update immediately
            }

            // Optionally, trigger a full refresh after a short delay to ensure data consistency
            // setTimeout(fetchTokens, 1000);


        } catch (error) {
            console.error(`Error checking token ${id}:`, error);
            showMessage(listStatus, `Error checking token ${id}: ${error.message}`, true);
             // Update status visually to network error
             const row = buttonElement.closest('tr');
             if (row) {
                 const statusCell = row.cells[4];
                 if (statusCell) statusCell.innerHTML = renderStatus('error_network');
             }
        } finally {
            buttonElement.textContent = originalButtonText;
            buttonElement.disabled = false;
             // Clear main status message if it was just for this check
             // setTimeout(() => { if (listStatus.textContent.startsWith(`Checking status for token ${id}`)) listStatus.textContent = ''; }, 3000);
        }
    };

     // Batch Check (Client-side loop for now)
    const checkSelectedTokens = async () => {
        const idsToCheck = Array.from(selectedTokenIds);
        if (idsToCheck.length === 0) {
            showMessage(listStatus, 'No tokens selected for checking.', true);
            return;
        }

        listStatus.textContent = `Checking ${idsToCheck.length} token(s)...`;
        checkSelectedBtn.disabled = true; // Disable batch button during check
        let successCount = 0;
        let errorCount = 0;

        // Find all check buttons for selected tokens
        const buttonsToCheck = [];
         idsToCheck.forEach(id => {
            const button = tokensTbody.querySelector(`.check-btn[data-id="${id}"]`);
            if (button) buttonsToCheck.push(button);
        });


        // Sequentially check for now to avoid overwhelming backend/APIs
        for (const button of buttonsToCheck) {
             const id = button.dataset.id;
             const type = button.dataset.type;
             try {
                // Reuse single check logic, but don't show individual messages
                button.textContent = 'Checking...';
                button.disabled = true;
                const response = await fetch(`${API_BASE_URL}/test-proxy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tokenId: id, type: type }),
                });
                 const result = await response.json();
                 if (response.ok && result.success) {
                    successCount++;
                 } else {
                    errorCount++;
                 }
                 // Update row immediately
                 const row = button.closest('tr');
                 if (row) {
                    const statusCell = row.cells[4];
                    const checkedCell = row.cells[5];
                    if (statusCell) statusCell.innerHTML = renderStatus(result.success ? 'valid' : `error_${result.status || response.status}`);
                    if (checkedCell) checkedCell.textContent = formatDate(new Date().toISOString());
                 }

             } catch (error) {
                 errorCount++;
                 console.error(`Error checking token ${id} during batch:`, error);
                  // Update row immediately
                 const row = button.closest('tr');
                 if (row) {
                    const statusCell = row.cells[4];
                    if (statusCell) statusCell.innerHTML = renderStatus('error_network');
                 }
             } finally {
                 button.textContent = 'Check'; // Reset button text
                 button.disabled = false;
             }
        }


        let message = `Batch check finished. ${successCount} successful, ${errorCount} failed.`;
        showMessage(listStatus, message, errorCount > 0);
        checkSelectedBtn.disabled = false; // Re-enable batch button
        // No full refresh needed as rows were updated individually
        updateToolbar(); // Update toolbar state (selection might not have changed)

    };


    // --- Rendering & Pagination ---
    const renderTokensPage = () => {
        tokensTbody.innerHTML = ''; // Clear existing rows
        headerSelectAllCheckbox.checked = false; // Reset header checkbox

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const tokensToShow = allTokens.slice(startIndex, endIndex);

        if (tokensToShow.length === 0) {
            tokensTbody.innerHTML = `<tr><td colspan="8">${allTokens.length > 0 ? 'No tokens on this page.' : 'No tokens found.'}</td></tr>`;
            updatePagination(); // Update controls even if empty
            return;
        }

        tokensToShow.forEach(token => {
            const row = tokensTbody.insertRow();
            const isSelected = selectedTokenIds.has(token.id);
            // Apply Tailwind classes directly in the row HTML
            row.innerHTML = `
                <td class="px-4 py-2 text-center align-middle"><input type="checkbox" class="token-select h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" data-id="${token.id}" ${isSelected ? 'checked' : ''}></td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 align-middle">${token.name || 'N/A'}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 font-mono align-middle">${token.key}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 align-middle">${token.type}</td>
                <td class="px-4 py-2 whitespace-nowrap text-sm align-middle">${renderStatus(token.status)}</td>
                <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-500 align-middle">${formatDate(token.lastChecked)}</td> 
                <td class="px-4 py-2 whitespace-nowrap text-xs text-gray-500 align-middle">${formatDate(token.lastUsed)}</td> 
                <td class="px-4 py-2 whitespace-nowrap text-sm space-x-2 align-middle">
                    <button class="check-btn px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-yellow-500" data-id="${token.id}" data-type="${token.type}">Check</button>
                    <button class="delete-btn px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500" data-id="${token.id}" data-name="${token.name || token.id}">Delete</button>
                </td>
            `;
        });

        // Add event listeners to new elements
        addEventListenersToRows();
        updatePagination(); // Update controls after rendering
        updateToolbar(); // Update button states
    };

    const updatePagination = () => {
        totalPages = Math.ceil(allTokens.length / itemsPerPage);
        if (totalPages < 1) totalPages = 1; // Ensure at least 1 page

        pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    };

    const changePage = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            renderTokensPage();
        }
    };

    const changeItemsPerPage = (event) => {
        itemsPerPage = parseInt(event.target.value, 10);
        currentPage = 1; // Reset to first page
        renderTokensPage();
    };

    // --- Selection Logic ---
    const updateToolbar = () => {
        const hasSelection = selectedTokenIds.size > 0;
        deleteSelectedBtn.disabled = !hasSelection;
        // Enable/disable other batch buttons here
        checkSelectedBtn.disabled = !hasSelection;
        // exportSelectedBtn.disabled = !hasSelection;

        // Update global select-all checkbox state
        toolbarSelectAllCheckbox.checked = allTokens.length > 0 && selectedTokenIds.size === allTokens.length;
        toolbarSelectAllCheckbox.indeterminate = selectedTokenIds.size > 0 && selectedTokenIds.size < allTokens.length;

        // Update header checkbox state (reflects current page)
        const checkboxesOnPage = tokensTbody.querySelectorAll('.token-select');
        const checkedOnPage = tokensTbody.querySelectorAll('.token-select:checked');
        headerSelectAllCheckbox.checked = checkboxesOnPage.length > 0 && checkedOnPage.length === checkboxesOnPage.length;
        headerSelectAllCheckbox.indeterminate = checkedOnPage.length > 0 && checkedOnPage.length < checkboxesOnPage.length;

    };

    const handleSelectionChange = (event) => {
        const checkbox = event.target;
        const tokenId = checkbox.dataset.id;
        if (checkbox.checked) {
            selectedTokenIds.add(tokenId);
        } else {
            selectedTokenIds.delete(tokenId);
        }
        updateToolbar();
    };

    const handleHeaderSelectAll = (event) => {
        const isChecked = event.target.checked;
        const checkboxesOnPage = tokensTbody.querySelectorAll('.token-select');
        checkboxesOnPage.forEach(cb => {
            cb.checked = isChecked;
            const tokenId = cb.dataset.id;
            if (isChecked) {
                selectedTokenIds.add(tokenId);
            } else {
                selectedTokenIds.delete(tokenId);
            }
        });
        updateToolbar();
    };

     const handleToolbarSelectAll = (event) => {
        const isChecked = event.target.checked;
        selectedTokenIds.clear(); // Clear first
        if (isChecked) {
            allTokens.forEach(token => selectedTokenIds.add(token.id));
        }
        renderTokensPage(); // Re-render to reflect changes across pages
        updateToolbar();
    };


    // Helper to add listeners to dynamically created rows
    const addEventListenersToRows = () => {
         // Delete buttons
        tokensTbody.querySelectorAll('.delete-btn').forEach(button => {
            // Remove existing listener to prevent duplicates if re-rendering
            button.replaceWith(button.cloneNode(true));
        });
        tokensTbody.querySelectorAll('.delete-btn').forEach(button => {
             button.addEventListener('click', () => {
                deleteToken(button.dataset.id, button.dataset.name);
            });
        });

         // Check buttons
        tokensTbody.querySelectorAll('.check-btn').forEach(button => {
            button.replaceWith(button.cloneNode(true)); // Remove old listener
        });
         tokensTbody.querySelectorAll('.check-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                checkTokenStatus(button.dataset.id, button.dataset.type, e.target);
            });
        });

        // Checkboxes
        tokensTbody.querySelectorAll('.token-select').forEach(checkbox => {
             // Remove existing listener
            checkbox.replaceWith(checkbox.cloneNode(true));
        });
         tokensTbody.querySelectorAll('.token-select').forEach(checkbox => {
            checkbox.addEventListener('change', handleSelectionChange);
        });
    }


    // --- Event Listeners ---
    addTokenForm.addEventListener('submit', addToken);
    refreshButton.addEventListener('click', fetchTokens);
    prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));
    itemsPerPageSelect.addEventListener('change', changeItemsPerPage);
    headerSelectAllCheckbox.addEventListener('change', handleHeaderSelectAll);
    toolbarSelectAllCheckbox.addEventListener('change', handleToolbarSelectAll);
    deleteSelectedBtn.addEventListener('click', deleteSelectedTokens);
    checkSelectedBtn.addEventListener('click', checkSelectedTokens); // Add listener for batch check
    // Add listeners for other batch buttons later

    // --- Initial Load ---
    fetchTokens();
});
