const express = require('express')
const cors = require("cors");
const { pool } = require('./dbConfig')
const bcrypt = require('bcrypt')

const passport = require('passport')

const initialize = require('./passport-config')
initialize(passport)
const session = require('express-session')
const flash = require('express-flash')

const app = express()

app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(session({
    secret:'secret',
    resave:false,
    saveUninitialized: false,
}))
app.use(flash())

app.use(passport.initialize())
app.use(passport.session())

app.use(express.static(__dirname + '/views'))
app.set('view engine', 'ejs')

const usersTableQuery = `
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(200) NOT NULL,
    type SMALLINT NOT NULL,
    UNIQUE(email)
);`

const productsTableQuery = `
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(100) NOT NULL,
    price NUMERIC(5,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    UNIQUE(name)
);`

//creating users table
pool
    .query(usersTableQuery)
    .then(res => {
        console.log('Users table successfully created');
    })
    .catch(err => {
        console.error(err);
    })

//creating products table
pool
    .query(productsTableQuery)
    .then(res => {
        console.log('Products table successfully created');
    })
    .catch(err => {
        console.error(err);
    })



app.get('/',(req,res)=>{
    res.render('html/index')
})

app.get('/login', checkAuthenticated, (req,res)=>{
    res.render('html/login')
})

app.get('/signup', checkAuthenticated, (req,res)=>{
    res.render('html/signup')
})

app.get('/dashboard', checkNotAuthenticated, (req,res)=>{
    if(req.user.type == 1){
        res.render('html/userdash',{ user: req.user.name, type: req.user.type})
    }else if(req.user.type == 2){
        res.render('html/deliverydash',{ user: req.user.name, type: req.user.type})
    }else if(req.user.type == 3){
        res.render('html/rootdash',{ user: req.user.name, type: req.user.type})
    }
})

app.post('/signup', async (req,res)=>{
    let { name, address, email, password, password2, type } = req.body;

    console.log({
        name,
        address,
        email,
        password,
        password2,
        type
    })

    let errors = []

    if(!name || !address || !email || !password || !password2 || !type){
        errors.push({message: "Please enter all fields"})
    }
    if(password.length < 6 ){
        errors.push({message: "Password should atleast be 6 characters long"})
    }
    if(password != password2){
        errors.push({message: "Passwords do not match"})
    }

    if(errors.length > 0){
        res.render('html/signup',{ errors })
    }else{
        // Form validation passed
        let hashedPassword = await bcrypt.hash(password, 10)
        console.log(hashedPassword)

        pool.query(
            `SELECT * FROM users
            WHERE email = $1`, [email], (err,result) => {
                if(err) throw err
                console.log(result.rows)

                if(result.rows.length > 0){
                    errors.push({ message: "Email already in use"})
                    res.render('html/signup', {errors})
                }else{
                    pool.query(
                        `INSERT INTO users (name,address,email,password, type)
                        VALUES($1, $2, $3, $4, $5)
                        RETURNING id, password`, [name, address, email, hashedPassword, type], (err,result)=>{
                            if(err) throw err
                            console.log(result)
                            req.flash('success_message', 'You are now registered, login to your account')
                            res.redirect('/login')
                        }
                    )
                }
            }
        )
    }
})

app.post('/dashboard/createpost',(req,res)=>{
    let {name, description, price, category} = req.body
    console.log({
        name,
        description,
        price,
        category
    })
    
    let errors = []

    if(!name || !description || !price || !category){
        errors.push({message: "Enter all fields"})
    }
    if(price <= 0){
        errors.push({message: "Please enter a valid price"})
    }
    if(errors.length > 0){
        res.render('html/rootdash',{ errors })
    }else{

        pool.query(
            `SELECT * FROM products
            WHERE name = $1`, [name], (err,result) => {
                if(err) throw err
                console.log(result.rows)

                if(result.rows.length > 0){
                    errors.push({ message: "Product already added"})
                    res.render('html/rootdash', {errors})
                }else{
                    pool.query(
                        `INSERT INTO products (name,description,price,category)
                        VALUES($1, $2, $3, $4)
                        RETURNING id`, [name, description, price, category], (err,result)=>{
                            if(err) throw err
                            console.log(result)
                            req.flash('success_message', 'Successfully added product!')
                            res.redirect('/dashboard')
                        }
                    )
                }
            }
        )

    }

})

app.post('/login',passport.authenticate('local',{
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
}))

app.get('/logout',(req,res)=>{
    req.logOut()
    req.flash('success_message','You have successfully logged out')
    res.redirect('/login')
})

function checkAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return res.redirect('/dashboard')
    }
    next()
}

function checkNotAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return next()
    }
    res.redirect('/login')
}

const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
    console.log(`Server started at port ${PORT}`)
})