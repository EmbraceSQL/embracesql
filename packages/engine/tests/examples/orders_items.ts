export const example = async (client): Promise<void> => {
  // little shortcut to type less...
  const db = client.databases.default.autocrud;

  // make a single item -- comes back with an object
  const { item_id } = await db.items.create({ description: "Paper" });

  // and array valued, make a few records in one shot...
  const more_item_keys = await db.items.create(
    { description: "Can" },
    { description: "Loaf" }
  );

  // no need to pass in the key, it is an auto increment, but you
  // sure will need it to put in order items, so let's capture the created key
  // whih EmbraceSQL thought of for you
  const { order_id } = await db.orders.create({ name: "Sample" });

  // now join items and orders with one of each
  // again notice we don't need to mention the autoincrement
  await db.order_items.create(
    [{ item_id }, ...more_item_keys].map((item_key) => ({
      order_id: order_id,
      item_id: item_key.item_id,
      quantity: 1,
    }))
  );

  // You can use that created key to 'read back' a record, kinda handy
  // oh -- and it pulls back the whole associated referential graph
  // your reward for embracing sql and referential integrity is not needing
  // to query to get child records like order_items or lookup data like items
  const my_order = await db.orders.read({ order_id });

  // notice three tables are joined automatically and you can get the description
  // EmbraceSQL inside created a query batch to pull in all this data
  // -- in one trip to the database, so it's not a chatterbox like ORMs
  const my_order_and_related = await db.orders.readWithRelated({ order_id });
  console.log(my_order_and_related);

  // And sometimes you really do need the whole table
  // This is even simpler, just don't pass any parameters!
  const all_orders = await db.orders.read();
  console.log(all_orders);

  // hmm -- I really want two of that... let's update, passing in all the order items
  // and using nice object spread with one property of overwrite
  await db.order_items.update({
    ...my_order.order_items,
    quantity: 2,
  });

  // nope -- I don't want it at all
  // delete the whole thing down the referentia graph
  await db.orders.delete({ order_id });

  // but the items aren't deleted -- they are lookup data!
  // EmbraceSQL is smart enough to only delete children
  console.log(await db.items.read());

  // clean up the items
  await db.items.delete(await db.items.read());
  console.log(await db.items.read());
};
