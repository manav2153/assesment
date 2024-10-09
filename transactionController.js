const axios= require('axios');
const Transaction = require('../models/Transaction');

// Utility function to parse month name to month number
const getMonthNumber = (monthName) => {
  const date = new Date(`${monthName} 1, 2020`); // Year is arbitrary
  if (isNaN(date)) return null;
  return date.getMonth() + 1;
};

// 1. Initialize Database
exports.initializeDatabase = async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    const data = response.data;

    // Clear existing data
    await Transaction.deleteMany({});

    // Seed data
    const transactions = data.map((item) => ({
      productId: item.productId,
      title: item.title,
      description: item.description,
      price: Number(item.price),
      category: item.category,
      dateOfSale: new Date(item.dateOfSale),
      sold: item.sold,
    }));

    await Transaction.insertMany(transactions);

    res.status(200).json({ message: 'Database initialized with seed data.' });
  } catch (error) {
    console.error('Error initializing database:', error.message);
    res.status(500).json({ error: 'Failed to initialize database.' });
  }
};

// 2. List Transactions with Search and Pagination
exports.listTransactions = async (req, res) => {
  try {
    const { month, search = '', page = 1, perPage = 10 } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required.' });
    }

    const monthNumber = getMonthNumber(month);
    if (!monthNumber) {
      return res.status(400).json({ error: 'Invalid month name.' });
    }

    const query = {
      $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { price: isNaN(Number(search)) ? undefined : Number(search) },
      ],
    };

    // Remove undefined if price is not a number
    if (isNaN(Number(search))) {
      delete query.$or[2];
    }

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .skip((page - 1) * perPage)
      .limit(Number(perPage));

    res.status(200).json({
      total,
      page: Number(page),
      perPage: Number(perPage),
      transactions,
    });
  } catch (error) {
    console.error('Error listing transactions:', error.message);
    res.status(500).json({ error: 'Failed to list transactions.' });
  }
};

// 3. Get Statistics
exports.getStatistics = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required.' });
    }

    const monthNumber = getMonthNumber(month);
    if (!monthNumber) {
      return res.status(400).json({ error: 'Invalid month name.' });
    }

    const match = {
      $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },
    };

    const totalSaleAmount = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);

    const totalSoldItems = await Transaction.countDocuments({ ...match, sold: true });
    const totalNotSoldItems = await Transaction.countDocuments({ ...match, sold: false });

    res.status(200).json({
      totalSaleAmount: totalSaleAmount[0]?.total || 0,
      totalSoldItems,
      totalNotSoldItems,
    });
  } catch (error) {
    console.error('Error getting statistics:', error.message);
    res.status(500).json({ error: 'Failed to get statistics.' });
  }
};

// 4. Get Bar Chart Data
exports.getBarChartData = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required.' });
    }

    const monthNumber = getMonthNumber(month);
    if (!monthNumber) {
      return res.status(400).json({ error: 'Invalid month name.' });
    }

    // Define price ranges
    const priceRanges = [
      { min: 0, max: 100 },
      { min: 101, max: 200 },
      { min: 201, max: 300 },
      { min: 301, max: 400 },
      { min: 401, max: 500 },
      { min: 501, max: 600 },
      { min: 601, max: 700 },
      { min: 701, max: 800 },
      { min: 801, max: 900 },
      { min: 901, max: Number.MAX_SAFE_INTEGER },
    ];

    const pipeline = [
      {
        $match: {
          $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },
        },
      },
      {
        $bucket: {
          groupBy: '$price',
          boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, Infinity],
          default: '901-above',
          output: {
            count: { $sum: 1 },
          },
        },
      },
      {
        $project: {
          _id: 0,
          range: {
            $switch: {
              branches: [
                { case: { $eq: ['$price', 0] }, then: '0-100' },
                { case: { $eq: ['$price', 1] }, then: '101-200' },
                { case: { $eq: ['$price', 2] }, then: '201-300' },
                { case: { $eq: ['$price', 3] }, then: '301-400' },
                { case: { $eq: ['$price', 4] }, then: '401-500' },
                { case: { $eq: ['$price', 5] }, then: '501-600' },
                { case: { $eq: ['$price', 6] }, then: '601-700' },
                { case: { $eq: ['$price', 7] }, then: '701-800' },
                { case: { $eq: ['$price', 8] }, then: '801-900' },
                { case: { $eq: ['$price', 9] }, then: '901-above' },
              ],
              default: 'Unknown',
            },
          },
          count: 1,
        },
      },
      {
        $sort: { range: 1 },
      },
    ];

    const results = await Transaction.aggregate(pipeline);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error getting bar chart data:', error.message);
    res.status(500).json({ error: 'Failed to get bar chart data.' });
  }
};

// 5. Get Pie Chart Data
exports.getPieChartData = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required.' });
    }

    const monthNumber = getMonthNumber(month);
    if (!monthNumber) {
      return res.status(400).json({ error: 'Invalid month name.' });
    }

    const pipeline = [
      {
        $match: {
          $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },
        },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          count: 1,
        },
      },
    ];

    const results = await Transaction.aggregate(pipeline);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error getting pie chart data:', error.message);
    res.status(500).json({ error: 'Failed to get pie chart data.' });
  }
};

// 6. Get Combined Data
exports.getCombinedData = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required.' });
    }

    // Fetch data concurrently
    const [statistics, barChart, pieChart] = await Promise.all([
      exports.getStatistics({ query: { month } }, { json: () => {} }),
      exports.getBarChartData({ query: { month } }, { json: () => {} }),
      exports.getPieChartData({ query: { month } }, { json: () => {} }),
    ]);

    // Alternatively, manually fetch and combine
    const monthNumber = getMonthNumber(month);
    if (!monthNumber) {
      return res.status(400).json({ error: 'Invalid month name.' });
    }

    // Statistics
    const match = {
      $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },
    };

    const totalSaleAmount = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);

    const totalSoldItems = await Transaction.countDocuments({ ...match, sold: true });
    const totalNotSoldItems = await Transaction.countDocuments({ ...match, sold: false });

    const statisticsData = {
      totalSaleAmount: totalSaleAmount[0]?.total || 0,
      totalSoldItems,
      totalNotSoldItems,
    };

    // Bar Chart Data
    const barPipeline = [
      {
        $match: {
          $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },
        },
      },
      {
        $bucket: {
          groupBy: '$price',
          boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, Infinity],
          default: '901-above',
          output: {
            count: { $sum: 1 },
          },
        },
      },
      {
        $project: {
          _id: 0,
          range: {
            $switch: {
              branches: [
                { case: { $eq: ['$price', 0] }, then: '0-100' },
                { case: { $eq: ['$price', 1] }, then: '101-200' },
                { case: { $eq: ['$price', 2] }, then: '201-300' },
                { case: { $eq: ['$price', 3] }, then: '301-400' },
                { case: { $eq: ['$price', 4] }, then: '401-500' },
                { case: { $eq: ['$price', 5] }, then: '501-600' },
                { case: { $eq: ['$price', 6] }, then: '601-700' },
                { case: { $eq: ['$price', 7] }, then: '701-800' },
                { case: { $eq: ['$price', 8] }, then: '801-900' },
                { case: { $eq: ['$price', 9] }, then: '901-above' },
              ],
              default: 'Unknown',
            },
          },
          count: 1,
        },
      },
      {
        $sort: { range: 1 },
      },
    ];

    const barChartData = await Transaction.aggregate(barPipeline);

    // Pie Chart Data
    const piePipeline = [
      {
        $match: {
          $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },
        },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          count: 1,
        },
      },
    ];

    const pieChartData = await Transaction.aggregate(piePipeline);

    // Combined Response
    const combinedData = {
      statistics: statisticsData,
      barChart: barChartData,
      pieChart: pieChartData,
    };

    res.status(200).json(combinedData);
  } catch (error) {
    console.error('Error getting combined data:', error.message);
    res.status(500).json({ error: 'Failed to get combined data.' });
  }
};