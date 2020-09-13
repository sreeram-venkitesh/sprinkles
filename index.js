const express = require("express");
const cors = require("cors");
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");

const passport = require("passport");

const initialize = require("./passport-config");
initialize(passport);
const session = require("express-session");
const flash = require("express-flash");

const app = express();

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

app.use(express.static(__dirname + "/views"));
app.set("view engine", "ejs");

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
  eta VARCHAR(20) DEFAULT '2 HOURS'
);`;

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

pool
  .query(ordersTableQuery)
  .then((res) => {
    console.log("Products table successfully created");
  })
  .catch((err) => {
    console.error(err);
  });

app.get("/", (req, res) => {
  res.render("html/index");
});

app.get("/login", checkAuthenticated, (req, res) => {
  res.render("html/login");
});

app.get("/signup", checkAuthenticated, (req, res) => {
  res.render("html/signup");
});

app.get("/dashboard", checkNotAuthenticated, (req, res) => {
  if (req.user.type == 1) {
    const query = `SELECT * FROM products;`;
    pool.query(query, (err, result) => {
      if (err) throw err;
      // rows = result.rows
      res.render("html/dashboard", {
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
        res.render("html/deliverydash", {
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
      res.render("html/product", { product: product, user: req.user });
    }
  );
});

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
      res.render("html/orders", {
        data: result.rows,
        user: req.user,
        currentOrders: currentOrders,
        pastOrders: pastOrders,
      });
    }
  );
});

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
  res.redirect("/dashboard");
});

app.post("/dashboard/delivered", (req, res) => {
  console.log(req.body.orderid);
  console.log(req.user.id);

  pool.query(`UPDATE orders
  SET dispatchstatus='Delivered',
  deliveredstatus='TRUE'
  WHERE id='${req.body.orderid}'`);
  res.redirect("/dashboard");
});

app.get('/viewproducts/delete/:id',(req,res)=>{
  pool.query(`DELETE FROM products
  WHERE id='${req.params.id}'`)
  req.flash('success_message',"Successfully deleted product")
  res.redirect('/dashboard/viewproducts')
})

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/logout", (req, res) => {
  req.logOut();
  req.flash("success_message", "You have successfully logged out");
  res.redirect("/login");
});

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
