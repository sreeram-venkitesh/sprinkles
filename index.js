const express = require('express')
const path = require("path");
const cors = require("cors");

const app = express()

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
    console.log(`Server started at port ${PORT}`)
})