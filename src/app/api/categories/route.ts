import { NextResponse } from 'next/server';

const CATEGORY_TREE = [
  { name: 'Grains', subcategories: ['Rice', 'Maize', 'Beans', 'Millet', 'Sorghum'] },
  { name: 'Tubers', subcategories: ['Yam', 'Cassava', 'Potato', 'Sweet Potato'] },
  { name: 'Vegetables', subcategories: ['Tomato', 'Pepper', 'Onion', 'Okra'] },
  { name: 'Fruits', subcategories: ['Mango', 'Orange', 'Banana', 'Pineapple'] },
  { name: 'Livestock', subcategories: ['Cattle', 'Goat', 'Sheep', 'Poultry'] },
  { name: 'Meat', subcategories: ['Beef', 'Chicken', 'Turkey', 'Fish'] },
  { name: 'Edible', subcategories: ['Groundnut Oil', 'Palm Oil', 'Honey'] },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: CATEGORY_TREE
  }, { status: 200 });
}
