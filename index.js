const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000 ;
var jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

//middleware

app.use(cors())
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dtpuxcz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("sports_academies").collection("users");
    const populerClassCollection = client.db("sports_academies").collection("populer");
    const instructorClassCollection = client.db("sports_academies").collection("instructor");
    const cartsClassCollection = client.db("sports_academies").collection("carts");
    const paymentCollection = client.db("sports_academies").collection("payments");


    //jwt
    app.post('/jwt',(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{ expiresIn: '1h' })

      res.send({token})
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // users related apis
    app.get('/users',verifyJWT,verifyAdmin,async(req,res)=>{
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    app.post('/users',async(req,res)=>{
      const user = req.body;
      console.log(user);
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query)
      console.log('hello user ',existingUser)
      if(existingUser){
        return res.send({massage: 'user already exists'})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })
    

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })



   app.patch('/users/admin/:id', async(req, res)=>{
    const id = req.params.id;
    console.log(id);
    const filter = { _id: new ObjectId(id)};
    const updateDoc = {
      $set: {
        role: 'admin'
      },
    };
    const result = await usersCollection.updateOne(filter,updateDoc);
    res.send(result);
   })




    app.get('/populer',async(req,res)=>{
        const result = await populerClassCollection.find().toArray();
        res.send(result);
    })
app.post('/populer', verifyJWT, verifyAdmin, async (req, res) => {
  const newItem = req.body;
  const result = await populerClassCollection.insertOne(newItem)
  res.send(result);
})

app.delete('/populer/:id', verifyJWT, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await populerClassCollection.deleteOne(query);
  res.send(result);
})





    app.get('/instructor',async(req,res)=>{
        const result = await instructorClassCollection.find().toArray();
        res.send(result);
    })

    // cart collection
    
    app.get('/carts', verifyJWT, async(req,res)=>{
        const email = req.query.email;
        console.log(email)
        if(!email){
            res.send([])
        }
        const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

        const query ={email: email};
        const result = await cartsClassCollection.find(query).toArray();
        res.send(result);
    })


    app.post("/carts",async(req,res)=>{
        const item = req.body;
        console.log(item);
        const result = await cartsClassCollection.insertOne(item);
        res.send(result);
    })

    app.delete('/carts/:id',async(req,res)=>{
      const id = req.params.id;
      console.log(id);
      const query = {_id: id};
      console.log(query);
      const result = await cartsClassCollection.deleteOne(query);
      res.send(result);
      
    })

      
     // create payment intent
     app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: { $in: payment.cartItems.map(id => id) } }
      const deleteResult = await cartsClassCollection.deleteMany(query)

      res.send({ insertResult, deleteResult });
    })

    app.get('/payments',async(req,res)=>{
      const result = await paymentCollection.find().toArray();
      res.send(result);
  })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/',(req,res)=>{
    res.send('server is running')
})

app.listen(port,()=>{
    console.log(`Server is running on port : ${port}`)
})