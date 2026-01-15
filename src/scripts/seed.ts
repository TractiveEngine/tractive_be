import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  createAdmin,
  createAgent,
  createTransporter,
  createBuyer,
  createFarmers,
  createProducts,
  createOrders,
  createTransaction,
  createBids,
  createTrucks,
  createDrivers,
  createShippingRequest,
  createNegotiationOffer,
  createNotifications,
  createSupportTickets,
  createWishlistItems,
  createReviews,
} from '../../tests/factories';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Connect to database
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    console.log('✅ Cleared all collections');

    // Create Admin
    console.log('👤 Creating admin user...');
    const { user: admin } = await createAdmin({
      email: 'admin@tractive.com',
      name: 'Admin User',
      phone: '+2348012345678',
    });
    console.log(`✅ Created admin: ${admin.email}`);

    // Create Agents
    console.log('👥 Creating agents...');
    const agents = [];
    for (let i = 1; i <= 3; i++) {
      const { user: agent } = await createAgent({
        email: `agent${i}@tractive.com`,
        name: `Agent ${i}`,
        businessName: `Agent Business ${i}`,
        phone: `+23480123456${70 + i}`,
        address: `${i} Agent Street, Lagos`,
        country: 'Nigeria',
        state: 'Lagos',
      });
      agents.push(agent);
    }
    console.log(`✅ Created ${agents.length} agents`);

    // Create Transporters
    console.log('🚚 Creating transporters...');
    const transporters = [];
    for (let i = 1; i <= 3; i++) {
      const { user: transporter } = await createTransporter({
        email: `transporter${i}@tractive.com`,
        name: `Transporter ${i}`,
        businessName: `Transport Co ${i}`,
        phone: `+23480123456${80 + i}`,
        address: `${i} Transport Avenue, Abuja`,
        country: 'Nigeria',
        state: 'Abuja',
      });
      transporters.push(transporter);
    }
    console.log(`✅ Created ${transporters.length} transporters`);

    // Create Buyers
    console.log('🛒 Creating buyers...');
    const buyers = [];
    for (let i = 1; i <= 5; i++) {
      const { user: buyer } = await createBuyer({
        email: `buyer${i}@example.com`,
        name: `Buyer ${i}`,
        phone: `+23480123456${90 + i}`,
        address: `${i} Buyer Road, Port Harcourt`,
        country: 'Nigeria',
        state: 'Rivers',
      });
      buyers.push(buyer);
    }
    console.log(`✅ Created ${buyers.length} buyers`);

    // Create Farmers (3 per agent)
    console.log('🌾 Creating farmers...');
    const allFarmers = [];
    for (const agent of agents) {
      const farmers = await createFarmers(3, agent._id, {
        country: 'Nigeria',
        state: 'Kaduna',
        approvalStatus: 'approved',
      });
      allFarmers.push(...farmers);
    }
    console.log(`✅ Created ${allFarmers.length} farmers`);

    // Create Products (5 per farmer)
    console.log('📦 Creating products...');
    const allProducts = [];
    const productNames = ['Maize', 'Rice', 'Beans', 'Yam', 'Cassava', 'Tomatoes', 'Pepper', 'Onions'];
    for (const farmer of allFarmers) {
      const products = await createProducts(5, farmer.createdBy, {
        categories: ['grain', 'vegetables'],
      });
      allProducts.push(...products);
    }
    console.log(`✅ Created ${allProducts.length} products`);

    // Create Orders
    console.log('📋 Creating orders...');
    const allOrders = [];
    for (let i = 0; i < 10; i++) {
      const buyer = buyers[i % buyers.length];
      const product = allProducts[i % allProducts.length];
      const transporter = i % 2 === 0 ? transporters[i % transporters.length]._id : undefined;

      const order = await createOrders(
        1,
        buyer._id,
        [{ product: product._id, quantity: Math.floor(Math.random() * 20) + 5 }],
        {
          status: i % 3 === 0 ? 'paid' : 'pending',
          transportStatus: i % 3 === 0 ? 'on_transit' : 'pending',
          transporter,
        }
      );
      allOrders.push(...order);
    }
    console.log(`✅ Created ${allOrders.length} orders`);

    // Create Transactions
    console.log('💰 Creating transactions...');
    for (let i = 0; i < allOrders.length; i++) {
      const order = allOrders[i];
      await createTransaction({
        order: order._id,
        buyer: order.buyer,
        amount: order.totalAmount,
        status: i % 2 === 0 ? 'approved' : 'pending',
        approvedBy: i % 2 === 0 ? admin._id : undefined,
      });
    }
    console.log(`✅ Created ${allOrders.length} transactions`);

    // Create Bids
    console.log('💵 Creating bids...');
    let bidCount = 0;
    for (let i = 0; i < 15; i++) {
      const buyer = buyers[i % buyers.length];
      const product = allProducts[i % allProducts.length];
      await createBids(1, product._id, buyer._id, {
        agent: product.owner,
        status: i % 3 === 0 ? 'accepted' : 'pending',
      });
      bidCount++;
    }
    console.log(`✅ Created ${bidCount} bids`);

    // Create Trucks & Drivers
    console.log('🚛 Creating trucks and drivers...');
    let truckCount = 0;
    let driverCount = 0;
    for (const transporter of transporters) {
      const trucks = await createTrucks(2, transporter._id);
      truckCount += trucks.length;

      const drivers = await createDrivers(2, transporter._id);
      driverCount += drivers.length;

      // Assign drivers to trucks
      if (trucks.length > 0 && drivers.length > 0) {
        trucks[0].assignedDriver = drivers[0]._id;
        await trucks[0].save();
        drivers[0].assignedTruck = trucks[0]._id;
        await drivers[0].save();
      }
    }
    console.log(`✅ Created ${truckCount} trucks and ${driverCount} drivers`);

    // Create Shipping Requests & Negotiations
    console.log('📮 Creating shipping requests and negotiations...');
    let shippingCount = 0;
    let negotiationCount = 0;
    for (let i = 0; i < 8; i++) {
      const buyer = buyers[i % buyers.length];
      const product = allProducts[i % allProducts.length];
      const transporter = transporters[i % transporters.length];

      const shippingRequest = await createShippingRequest({
        buyer: buyer._id,
        product: product._id,
        productName: product.name,
        negotiable: i % 2 === 0,
        status: i % 3 === 0 ? 'accepted' : 'pending',
        transporter: i % 3 === 0 ? transporter._id : null,
      });
      shippingCount++;

      if (i % 2 === 0) {
        await createNegotiationOffer({
          shippingRequest: shippingRequest._id,
          transporter: transporter._id,
          negotiatorName: transporter.name || 'Negotiator',
          negotiationStatus: i % 3 === 0 ? 'accepted' : 'pending',
        });
        negotiationCount++;
      }
    }
    console.log(`✅ Created ${shippingCount} shipping requests and ${negotiationCount} negotiations`);

    // Create Notifications
    console.log('🔔 Creating notifications...');
    let notificationCount = 0;
    for (const buyer of buyers) {
      await createNotifications(3, buyer._id, {
        type: 'order_created',
        title: 'Order Created',
        message: 'Your order has been created successfully',
        isRead: Math.random() > 0.5,
      });
      notificationCount += 3;
    }
    console.log(`✅ Created ${notificationCount} notifications`);

    // Create Support Tickets
    console.log('🎫 Creating support tickets...');
    let ticketCount = 0;
    for (let i = 0; i < 10; i++) {
      const user = [...buyers, ...agents, ...transporters][i % (buyers.length + agents.length + transporters.length)];
      await createSupportTickets(1, user._id, {
        subject: `Support Issue ${i + 1}`,
        status: i % 3 === 0 ? 'resolved' : 'open',
        priority: i % 2 === 0 ? 'high' : 'medium',
      });
      ticketCount++;
    }
    console.log(`✅ Created ${ticketCount} support tickets`);

    // Create Wishlist Items
    console.log('❤️ Creating wishlist items...');
    let wishlistCount = 0;
    for (const buyer of buyers) {
      const randomProducts = allProducts
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(p => p._id);
      await createWishlistItems(buyer._id, randomProducts);
      wishlistCount += randomProducts.length;
    }
    console.log(`✅ Created ${wishlistCount} wishlist items`);

    // Create Reviews
    console.log('⭐ Creating reviews...');
    let reviewCount = 0;
    for (let i = 0; i < 12; i++) {
      const buyer = buyers[i % buyers.length];
      const agent = agents[i % agents.length];
      await createReviews(1, agent._id, buyer._id, {
        rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
        comment: 'Great service and quality products!',
      });
      reviewCount++;
    }
    console.log(`✅ Created ${reviewCount} reviews`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - 1 Admin`);
    console.log(`   - ${agents.length} Agents`);
    console.log(`   - ${transporters.length} Transporters`);
    console.log(`   - ${buyers.length} Buyers`);
    console.log(`   - ${allFarmers.length} Farmers`);
    console.log(`   - ${allProducts.length} Products`);
    console.log(`   - ${allOrders.length} Orders`);
    console.log(`   - ${allOrders.length} Transactions`);
    console.log(`   - ${bidCount} Bids`);
    console.log(`   - ${truckCount} Trucks`);
    console.log(`   - ${driverCount} Drivers`);
    console.log(`   - ${shippingCount} Shipping Requests`);
    console.log(`   - ${negotiationCount} Negotiations`);
    console.log(`   - ${notificationCount} Notifications`);
    console.log(`   - ${ticketCount} Support Tickets`);
    console.log(`   - ${wishlistCount} Wishlist Items`);
    console.log(`   - ${reviewCount} Reviews`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the seed function
seed();
