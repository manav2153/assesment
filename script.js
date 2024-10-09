document.addEventListener('DOMContentLoaded', () => {
    const monthSelect = document.getElementById('monthSelect');
    const searchBox = document.getElementById('searchBox');
    const transactionsBody = document.getElementById('transactionsBody');
    const totalAmount = document.getElementById('totalAmount');
    const totalSoldItems = document.getElementById('totalSoldItems');
    const totalNotSoldItems = document.getElementById('totalNotSoldItems');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const transactionsChart = document.getElementById('transactionsChart').getContext('2d');

    let currentPage = 1;

    const fetchTransactions = async (month, searchText = '', page = 1) => {
        const response = await fetch(`/api/transactions?month=${month}&search=${searchText}&page=${page}`);
        const data = await response.json();
        
        // Populate the transactions table
        transactionsBody.innerHTML = '';
        data.transactions.forEach(transaction => {
            const row = `<tr>
                <td>${transaction.title}</td>
                <td>${transaction.description}</td>
                <td>${transaction.price}</td>
            </tr>`;
            transactionsBody.innerHTML += row;
        });

        // Update statistics
        totalAmount.textContent = data.stats.totalAmount;
        totalSoldItems.textContent = data.stats.totalSoldItems;
        totalNotSoldItems.textContent = data.stats.totalNotSoldItems;

        // Update chart
        updateChart(data.chartData);
    };

    const updateChart = (chartData) => {
        new Chart(transactionsChart, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Number of Items',
                    data: chartData.data,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    };

    const loadTransactions = () => {
        const month = monthSelect.value;
        const searchText = searchBox.value;
        fetchTransactions(month, searchText, currentPage);
    };

    monthSelect.addEventListener('change', loadTransactions);
    searchBox.addEventListener('input', loadTransactions);

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadTransactions();
        }
    });

    nextBtn.addEventListener('click', () => {
        currentPage++;
        loadTransactions();
    });

    // Initial load
    fetchTransactions(2); // Load March transactions by default
});







  
