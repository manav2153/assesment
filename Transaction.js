
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
  },
  title: String,
  description: String,
  price: Number,
  category: String,
  dateOfSale: Date,
  sold: {
    type: Boolean,
    default: false,
  },
});


// src/app.js

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const transactionRoutes = require('./routes/transactionRoutes');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/transactions', transactionRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.send('MERN Backend Task API');
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;
module.exports = mongoose.model('Transaction', TransactionSchema);
