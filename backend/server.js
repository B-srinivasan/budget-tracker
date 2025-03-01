const bcrypt = require("bcrypt");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const session = require('express-session');
require("dotenv").config();
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Create app
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(cors());
app.use(session({
  secret: 'budget-secret-key',
  resave: false,
  saveUninitialized: false
}));

// MongoDB connection for signup and login databases
const signupDB = mongoose.createConnection("mongodb://localhost:27017/signupDB");
signupDB.on("error", () => console.log("Error connecting to Signup Database"));
signupDB.once("open", () => console.log("Connected to Signup Database"));

const loginDB = mongoose.createConnection("mongodb://localhost:27017/loginDB");
loginDB.on("error", () => console.log("Error connecting to Login Database"));
loginDB.once("open", () => console.log("Connected to Login Database"));

// MongoDB connection

mongoose.connect("mongodb://localhost:27017/expense-tracker")
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// Define schemas and models

const signupUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: Number, required: true },
  gender: { type: String, required: true },
  resetToken: { type: String }, // For password reset
  resetTokenExpiry: { type: Date }, // Expiry for the reset token
});
const SignupUser = signupDB.model("User", signupUserSchema);

const loginUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  password: { type: String, required: true },
});
const LoginUser = loginDB.model("User", loginUserSchema);


const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true }
});
const Expense = mongoose.model('Expense', expenseSchema);

app.get("/forgot-password", (req, res) => {
  res.sendFile(path.resolve(__dirname,"../frontend", "/forgot-password.html"));
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send("<p>Invalid email address❌</p>");
  }

  try {
    const user = await SignupUser.findOne({ email });

    if (!user) {
      return res.status(404).send("<p>Email not registered❌</p>");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Create reset link
    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;

    // Send email with reset link
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Choose your email service
      auth: {
        user: process.env.EMAIL, // Email from your .env file
        pass: process.env.EMAIL_PASSWORD, // App-specific password or your email password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "Password Reset Request",
      text: `Hi ${user.name},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you didn't request this, please ignore this email.\n\nThanks,\nExpense Tracker Team`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err.message);
        return res.status(500).send("<p>Failed to send email. Please try again later.</p>");
      }
      console.log("Email sent:", info.response);
      return res.status(200).send("<p>A password reset link has been sent to your email. Please check your inbox to continue.</p>");
    });
  } catch (error) {
    console.error("Error during forgot password:", error.message);
    return res.status(500).send("<p>An error occurred. Please try again later.</p>");
  }
});

app.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const user = await SignupUser.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send(`
        <html>
          <head><title>Password Reset</title></head>
          <body>
            <h2>Password Reset</h2>
            <p>Invalid or expired token❌</p>
          </body>
        </html>
      `);
    }

    // If token is valid, render the form with a message area
    res.send(`
      <html>
    <head><title>Password Reset</title>
     <style>
/* General body styling */
body {
font-family: 'Arial', sans-serif;
background-color: #f9f9f9;
color: #333;
margin: 0;
padding: 0;
display: flex;
justify-content: center;
align-items: center;
height: 100vh;
}

/* Form container styling */
form {
background: #ffffff;
border-radius: 8px;
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
padding: 20px;
width: 100%;
max-width: 400px;
box-sizing: border-box;
align-items: center;
}

/* Form heading */
h2 {

text-align: center;
margin-bottom: 40px;
color: #444;
}

/* Input styling */
input[type="password"] {
width: calc(100% - 40px);
padding: 10px;
margin: 10px 0;
border: 1px solid #ccc;
border-radius: 4px;
box-sizing: border-box;
font-size: 14px;
}
/* Button styling */
button {
width: 100%;
padding: 10px;
border: none;
border-radius: 4px;
background-color:#6a1b9a;
color: #fff;
font-size: 16px;
font-weight: bold;
cursor: pointer;
margin-top: 10px;
transition: background-color 0.3s ease;
}

button:hover {
background-color:#6a1b9a;
}

/* Message div styling */
#message {
margin-top: 10px;
font-size: 14px;
text-align: center;
}

/* Add some responsiveness */
@media (max-width: 480px) {
form {
padding: 15px;
}

button {
font-size: 14px;
}
}</style>
<link rel="stylesheet" href="https://unicons.iconscout.com/release/v4.0.0/css/line.css" /></head>
    <body><center>
      <h2>Password Reset</h2>
      <div id="message"></div> <!-- Message will be shown here -->
      <form action="/reset-password" method="POST" id="reset-password-form">
        <input type="hidden" name="token" value="${token}" />
        <label for="newPassword">New Password:</label>
        <input type="password" id="newPassword" name="newPassword" required>
        <button type="submit">Reset Password</button>
      </form>
    </center>
      <script>
      
        const form = document.getElementById('reset-password-form');
        form.addEventListener('submit', async (event) => {
          event.preventDefault(); // Prevents the form from reloading the page

          const formData = new FormData(form);
          const newPassword = formData.get('newPassword');
          const token = formData.get('token');

          try {
            const response = await fetch('/reset-password', {
              method: 'POST',
              body: new URLSearchParams({ token, newPassword }),
            });

            const result = await response.text();
            document.getElementById('message').innerHTML = result; // Display message in the div
          } catch (error) {
            document.getElementById('message').innerHTML = "<p>Error occurred. Please try again later.</p>";
          }
        });
      </script>
    </body>
  </html>
    `);
  } catch (error) {
    console.error("Error during token validation:", error);
    res.status(500).send("<p>An error occurred. Please try again later.</p>");
  }
});

app.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  // Validate password strength
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).send("<p>Password must be at least 8 characters long, include one letter, one number, and one special character❌</p>");
  }

  try {
    const user = await SignupUser.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send("<p>Invalid or expired token❌</p>");
    }

    // Hash the new password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();

    res.status(200).send("<p>Password reset successfully! You can now log in.</p>");
  } catch (error) {
    console.error("Error during password reset:", error.message);
    res.status(500).send("<p>An error occurred. Please try again later.</p>");
  }
});

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../frontend", "index.html"));
});

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, createpassword ,mobile, gender} = req.body;

    // Check if passwords match
    if (password !== createpassword) {
      return res.status(400).send("Passwords do not match❌");
    }

    // Check if user already exists
    const userExists = await SignupUser.findOne({ name });
    if (userExists) {
      return res.status(400).send("User already exists❌");
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with hashed password
    const newUser = new SignupUser({ name, email, password: hashedPassword ,mobile, gender});

    // Save new user to the database
    await newUser.save();

    return res.status(201).send("User registered successfully!");
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).send("An error occurred. Please try again later.");
  }
});


app.post("/login", async (req, res) => {
  try {
    const { name, password } = req.body;

    // Check if both name and password are provided
    if (!name || !password) {
      return res.status(400).send("Name and Password are required❌");
    }

    // Fetch the user from the signup database
    const user = await SignupUser.findOne({ name });
    if (!user) {
      console.log("Login attempt failed: User not found");
      return res.status(404).send("User not found❌");
    }

    // Compare the entered password with the hashed password in the database
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (isPasswordCorrect) {
      console.log("Login successful for user:", user.name);

      // Save login attempt in the login database
      const loginUser = new LoginUser({ name, password });
      await loginUser.save();

      // Store user ID in session
      req.session.userId = user._id;

      // Serve the user.html file
      return res.sendFile(path.resolve(__dirname, "../frontend/user", "dashboard.html"));
    } else {
      console.log("Login attempt failed: Incorrect password");
      return res.status(401).send("Invalid Password!❌");
    }
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).send("An error occurred during login❌");
  }
});

app.get("/api/expenses", async (req, res) => {
  const userId = req.session.userId;
  try {
    const expenses = await Expense.find({ userId });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

app.post("/api/expenses", async (req, res) => {
  const userId = req.session.userId;
  const { date, category, amount, description } = req.body;
  try {
    const newExpense = new Expense({ userId, date, category, amount, description });
    const savedExpense = await newExpense.save();
    res.status(201).json(savedExpense);
  } catch (err) {
    res.status(500).json({ error: "Failed to add expense" });
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
      const expense = await Expense.findByIdAndDelete(req.params.id);
      if (!expense) {
          return res.status(404).json({ error: "Expense not found" });
      }
      res.json({ message: "Expense deleted successfully" });
  } catch (error) {
      res.status(500).json({ error: "Failed to delete expense", details: error });
  }
});


const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  name: { type: String, required: true },
  income: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  food: { type: Number, default: 0 },
  foodSpent: { type: Number, default: 0 }, 
  transportation: { type: Number, default: 0 },
  transportationSpent: { type: Number, default: 0 }, 
  shopping: { type: Number, default: 0 },
  shoppingSpent: { type: Number, default: 0 }, 
  bills: { type: Number, default: 0 },
  billsSpent: { type: Number, default: 0 }, 
  entertainment: { type: Number, default: 0 },
  entertainmentSpent: { type: Number, default: 0 }, 
  education: { type: Number, default: 0 },
  educationSpent: { type: Number, default: 0 }, 
  other: { type: Number, default: 0 },
  otherSpent: { type: Number, default: 0 } 
});

const Budget = mongoose.model("Budget", budgetSchema);

app.post("/api/budgets", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });

  const { name, income, startDate, endDate, food, transportation, shopping, bills, entertainment, education, other, foodSpent, transportationSpent, shoppingSpent, billsSpent, entertainmentSpent, educationSpent, otherSpent } = req.body;

  const newBudget = new Budget({
    userId: req.session.userId,
    name,
    income,
    startDate,
    endDate,
    food,
    transportation,
    shopping,
    bills,
    entertainment,
    education,
    other,
    foodSpent,
    transportationSpent,
    shoppingSpent,
    billsSpent,
    entertainmentSpent,
    educationSpent,
    otherSpent
  });

  try {
    const savedBudget = await newBudget.save();
    res.status(201).json(savedBudget);
  } catch (err) {
    res.status(500).json({ error: "Failed to add budget" });
  }
});

app.put("/api/budgets/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });

  const { name, income, startDate, endDate, food, transportation, shopping, bills, entertainment, education, other, foodSpent, transportationSpent, shoppingSpent, billsSpent, entertainmentSpent, educationSpent, otherSpent } = req.body;

  try {
    const updatedBudget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      {
        name,
        income,
        startDate,
        endDate,
        food,
        transportation,
        shopping,
        bills,
        entertainment,
        education,
        other,
        foodSpent,
        transportationSpent,
        shoppingSpent,
        billsSpent,
        entertainmentSpent,
        educationSpent,
        otherSpent
      },
      { new: true } // Return the updated document
    );

    if (!updatedBudget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    res.json(updatedBudget);
  } catch (err) {
    res.status(500).json({ error: "Failed to update budget" });
  }
});

app.get("/api/budgets", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const budgets = await Budget.find({ userId: req.session.userId });
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

// GET - Fetch a specific budget by id
app.get("/api/budgets/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const budget = await Budget.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!budget) return res.status(404).json({ error: "Budget not found" });
    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch budget details" });
  }
});

// DELETE - Delete a specific budget
app.delete("/api/budgets/:id", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    await Budget.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.status(200).json({ message: "Budget deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

app.get("/api/reports", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const expenses = await Expense.find({ userId: req.session.userId });
    const budgets = await Budget.find({ userId: req.session.userId });

    if (!budgets.length) {
      return res.json({ message: "No budgets found" });
    }

    // Date-wise Expense Calculation
    let dateWiseExpenses = {};
    expenses.forEach((exp) => {
        const date = new Date(exp.date).toLocaleDateString("en-GB"); // dd/mm/yyyy
        if (!dateWiseExpenses[date]) {
            dateWiseExpenses[date] = { total: 0, categories: {} };
        }
        dateWiseExpenses[date].total += exp.amount;
        dateWiseExpenses[date].categories[exp.category] =
            (dateWiseExpenses[date].categories[exp.category] || 0) + exp.amount;
    });

    const dateWiseArray = Object.keys(dateWiseExpenses).map((date) => ({
        date,
        total: dateWiseExpenses[date].total,
        categories: Object.keys(dateWiseExpenses[date].categories).map((cat) => ({
            name: cat,
            amount: dateWiseExpenses[date].categories[cat],
        })),
    }));

    const report = budgets.reduce(
      (acc, budget) => {
        acc.totalIncome += budget.income || 0;
        acc.totalFood += budget.foodSpent || 0;
        acc.totalTransportation += budget.transportationSpent || 0;
        acc.totalShopping += budget.shoppingSpent || 0;
        acc.totalBills += budget.billsSpent || 0;
        acc.totalEntertainment += budget.entertainmentSpent || 0;
        acc.totalEducation += budget.educationSpent || 0;
        acc.totalOther += budget.otherSpent || 0;
        return acc;
      },
      {
        totalIncome: 0,
        totalFood: 0,
        totalTransportation: 0,
        totalShopping: 0,
        totalBills: 0,
        totalEntertainment: 0,
        totalEducation: 0,
        totalOther: 0,
      }
    );

    // Total Budget Calculation
    const totalBudget = report.totalIncome;

    // **Calculate Total Expenses from Budget Spent Fields**
    const totalExpenses =
      report.totalFood +
      report.totalTransportation +
      report.totalShopping +
      report.totalBills +
      report.totalEntertainment +
      report.totalEducation +
      report.totalOther;

    // Budget Insights
    let insights = {
      budgetExceeded: totalExpenses > totalBudget,
      savingsTip:
        totalExpenses < totalBudget
          ? "✅ You're saving money! Consider investing your savings."
          : "⚠️ Your spending exceeds your income. Try cutting unnecessary expenses.",
      highestCategory: null,
    };

    // Identify Highest Spending Category
    let categoryExpenses = {
      Food: report.totalFood,
      Transportation: report.totalTransportation,
      Shopping: report.totalShopping,
      Bills: report.totalBills,
      Entertainment: report.totalEntertainment,
      Education: report.totalEducation,
      Other: report.totalOther,
    };

    let highestCategory = Object.entries(categoryExpenses).reduce(
      (max, category) => (category[1] > max[1] ? category : max),
      ["None", 0]
    );

    insights.highestCategory = highestCategory[0];

    // ✅ **Send only ONE response with all data**
    res.json({
      ...report,
      totalBudget,
      totalExpenses,
      insights,
      dateWiseExpenses: dateWiseArray,  // Added here
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to generate reports", details: error });
  }
});



// Start the server
app.listen(3000, () => {
  console.log("Server started on port 3000");
});