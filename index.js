const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const passport = require("passport");
const session = require("express-session");
const flash = require("express-flash");

const { pool } = require("./dbConfig");
const initialize = require("./passport-config");
initialize(passport);


const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

//Seting static directory and view engine
app.use(express.static(__dirname + "/views"));
app.set("view engine", "ejs");

// Postgresql queries for creatin user, product and orders table 
const usersTableQuery = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(200) NOT NULL,
    type SMALLINT NOT NULL,
    UNIQUE(email)
);`;

const productsTableQuery = `
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(100) NOT NULL,
    price NUMERIC(5,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    UNIQUE(name)
);`;

const ordersTableQuery = `
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  productname VARCHAR(100) NOT NULL,
  quantity SMALLINT NOT NULL,
  customer VARCHAR(100) NOT NULL,
  address VARCHAR(100) NOT NULL,
  productprice NUMERIC(5,2) NOT NULL,
  total NUMERIC(5,2) NOT NULL,
  deliveryId SMALLINT DEFAULT NULL,
  deliveryName VARCHAR(20) DEFAULT NULL,
  dispatchStatus VARCHAR(20) DEFAULT 'Not Picked Up',
  deliveredStatus BOOLEAN DEFAULT FALSE,
  eta VARCHAR(20) DEFAULT '2'
);`;

// These blocks of code below will be run only the first time
// the app is run locally/in the server to create the tables
// in the database

//creating users table
pool
  .query(usersTableQuery)
  .then((res) => {
    console.log("Users table successfully created");
  })
  .catch((err) => {
    console.error(err);
  });

//creating products table
pool
  .query(productsTableQuery)
  .then((res) => {
    console.log("Products table successfully created");
  })
  .catch((err) => {
    console.error(err);
  });

  //creating orders table
pool
  .query(ordersTableQuery)
  .then((res) => {
    console.log("Orders table successfully created");
  })
  .catch((err) => {
    console.error(err);
  });

//Rendering the pages which does not require authentication
app.get("/", (req, res) => {
  res.render("html/index");
});

app.get("/login", checkAuthenticated, (req, res) => {
  res.render("html/login");
});

app.get("/signup", checkAuthenticated, (req, res) => {
  res.render("html/signup");
});

// Writing user details into when registering
app.post("/signup", async (req, res) => {
  let { name, address, email, password, password2, type } = req.body;

  console.log({
    name,
    address,
    email,
    password,
    password2,
    type,
  });

  let errors = [];

  if (!name || !address || !email || !password || !password2 || !type) {
    errors.push({ message: "Please enter all fields" });
  }
  if (password.length < 6) {
    errors.push({
      message: "Password should atleast be 6 characters long",
    });
  }
  if (password != password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    res.render("html/signup", { errors });
  } else {
    // Form validation passed
    let hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);

    pool.query(
      `SELECT * FROM users
            WHERE email = $1`,
      [email],
      (err, result) => {
        if (err) throw err;
        console.log(result.rows);

        if (result.rows.length > 0) {
          errors.push({ message: "Email already in use" });
          res.render("html/signup", { errors });
        } else {
          pool.query(
            `INSERT INTO users (name,address,email,password, type)
                        VALUES($1, $2, $3, $4, $5)
                        RETURNING id, password`,
            [name, address, email, hashedPassword, type],
            (err, result) => {
              if (err) throw err;
              console.log(result);
              req.flash(
                "success_message",
                "You are now registered, login to your account"
              );
              res.redirect("/login");
            }
          );
        }
      }
    );
  }
});

// Auth during log in
app.post("/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

//Routes for the pages which requires authorisation

// In the dashboard route, the user type is checked from the 
// value they have given while registering and a different page
// is rendered for each type of user - customer, delivery and admin

app.get("/dashboard", checkNotAuthenticated, (req, res) => {
  if (req.user.type == 1) {
    const query = `SELECT * FROM products;`;
    pool.query(query, (err, result) => {
      if (err) throw err;
      // rows = result.rows
      res.render("html/customer/dashboard", {
        user: req.user.name,
        type: req.user.type,
        data: result.rows,
      });
    });
  } else if (req.user.type == 2) {
    pool.query(
      `SELECT * FROM orders WHERE address = $1`,
      [req.user.address],
      (err, result) => {
        if (err) throw err;
        const eligibleOrders = result.rows.filter(
          (order) => order.dispatchstatus == "Not Picked Up"
        );
        const yourOrders = result.rows.filter(
          (order) =>
            order.deliveryid == req.user.id &&
            order.dispatchstatus != "Delivered"
        );
        res.render("html/delivery/deliverydash", {
          user: req.user.name,
          type: req.user.type,
          eligibleOrders: eligibleOrders,
          yourOrders: yourOrders,
        });
      }
    );
  } else if (req.user.type == 3) {
    res.render("html/admin/rootdash", {
      user: req.user.name,
      type: req.user.type,
    });
  }
});


// Admin adding product
app.post("/dashboard/createpost", (req, res) => {
  let { name, description, price, category } = req.body;
  console.log({
    name,
    description,
    price,
    category,
  });

  let errors = [];

  if (!name || !description || !price || !category) {
    errors.push({ message: "Enter all fields" });
  }
  if (price <= 0) {
    errors.push({ message: "Please enter a valid price" });
  }
  if (errors.length > 0) {
    res.render("html/admin/rootdash", { errors });
  } else {
    pool.query(
      `SELECT * FROM products
            WHERE name = $1`,
      [name],
      (err, result) => {
        if (err) throw err;
        console.log(result.rows);

        if (result.rows.length > 0) {
          errors.push({ message: "Product already added" });
          res.render("html/admin/rootdash", { errors });
        } else {
          pool.query(
            `INSERT INTO products (name,description,price,category)
                        VALUES($1, $2, $3, $4)
                        RETURNING id`,
            [name, description, price, category],
            (err, result) => {
              if (err) throw err;
              console.log(result);
              req.flash("success_message", "Successfully added product!");
              res.redirect("/dashboard");
            }
          );
        }
      }
    );
  }
});

// Admin viewing all the users
app.get("/dashboard/viewusers", (req, res) => {
  // if(req.user.type != 3){
  //   res.redirect('/dashboard')
  // }
  pool.query(`SELECT * FROM users;`, (err, result) => {
    res.render("html/admin/viewusers", {
      users: result.rows,
      user: req.user,
    });
  });
});

// Admin viewing all the products
app.get("/dashboard/viewproducts", (req, res) => {
  // if(req.user.type != 3){
  //   res.redirect('/dashboard')
  // }
  pool.query(`SELECT * FROM products;`, (err, result) => {
    res.render("html/admin/viewproducts", {
      products: result.rows,
      user: req.user,
    });
  });
});

// Admin viewing all the orders
app.get("/dashboard/vieworders", (req, res) => {
  // if(req.user.type != 3){
  //   res.redirect('/dashboard')
  // }
  pool.query(`SELECT * FROM orders;`, (err, result) => {
    res.render("html/admin/vieworders", {
      orders: result.rows,
      user: req.user,
    });
  });
});

// Admin updating user roles
app.post('/dashboard/viewusers/updateuser',(req,res)=>{
  const {userid,newType} = req.body
  pool.query(`UPDATE users
  SET type=${newType}
  WHERE id=${userid}`,(err,result)=>{
    console.log('User updated successfully')
    req.flash('success_message',"Succesfully updated user!")
    res.redirect('/dashboard/viewusers')
  })
})

// Admin deleting a product
app.get('/viewproducts/delete/:id',(req,res)=>{
  pool.query(`DELETE FROM products
  WHERE id='${req.params.id}'`)
  req.flash('success_message',"Successfully deleted product")
  res.redirect('/dashboard')
})


// Customer viewing product
app.get("/dashboard/products/:id", checkNotAuthenticated, (req, res) => {
  if (req.user.type != 1) {
    res.redirect("/dashboard");
  }
  console.log(req.params.id);
  let product;
  pool.query(
    `SELECT * FROM products WHERE id = $1`,
    [req.params.id],
    (err, result) => {
      if (err) throw err;
      product = result.rows[0];
      res.render("html/customer/product", { product: product, user: req.user });
    }
  );
});

// Customer ordering product
app.post("/dashboard/products", (req, res) => {
  let {
    qty,
    productname,
    username,
    useraddress,
    productprice,
    total,
  } = req.body;
  console.log({
    qty: qty,
    productname: productname,
    username: username,
    useraddress: useraddress,
    productprice: productprice,
    total: total,
  });

  pool.query(
    `INSERT INTO orders (productname, quantity, customer, address, productprice, total)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id `,
    [productname, qty, username, useraddress, productprice, total],
    (err, result) => {
      if (err) throw err;
      console.log(result.rows);
      req.flash("success_message", `Successfully ordered ${productname}`);
      res.redirect("/dashboard/orders");
    }
  );
});

//Customer viewing their orders and its status
app.get("/dashboard/orders", checkNotAuthenticated, (req, res) => {
  if (req.user.type != 1) {
    res.redirect("/dashboard");
  }
  pool.query(
    `SELECT * FROM orders WHERE customer = $1`,
    [req.user.name],
    (err, result) => {
      const currentOrders = result.rows.filter(
        (order) => order.dispatchstatus != "Delivered"
      );

      const pastOrders = result.rows.filter(
        (order) => order.dispatchstatus == "Delivered"
      );

      console.log(result.rows);
      res.render("html/customer/orders", {
        data: result.rows,
        user: req.user,
        currentOrders: currentOrders,
        pastOrders: pastOrders,
      });
    }
  );
});

// Delivery person claiming an order and updating ETA as per their location
app.post("/dashboard/deliverydash", (req, res) => {
  console.log(req.body);
  console.log(req.user.id);

  pool.query(`UPDATE orders
  SET dispatchstatus='Dispatched',
  deliveryid='${req.user.id}',
  deliveryname='${req.user.name}',
  eta='${req.body.eta}'
  WHERE id='${req.body.orderid}'
  RETURNING id;`);
  req.flash('success_message','Successfully claimed order')
  res.redirect("/dashboard/orders");
});

// Delivery person marking order as delivered
app.post("/dashboard/delivered", (req, res) => {
  console.log(req.body.orderid);
  console.log(req.user.id);

  pool.query(`UPDATE orders
  SET dispatchstatus='Delivered',
  deliveredstatus='TRUE'
  WHERE id='${req.body.orderid}'`);
  req.flash('success_message','Successfully delivered order')

  res.redirect("/dashboard/orders");
});

// Logging out 
app.get("/logout", (req, res) => {
  req.logOut();
  req.flash("success_message", "You have successfully logged out");
  res.redirect("/login");
});

// Middlewares to check if user is authenticated to access a page
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started at port ${PORT}`);
});
