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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const withSubcategories = searchParams.get('withSubcategories') === 'true';

  if (withSubcategories) {
    return NextResponse.json({
      success: true,
      data: CATEGORY_TREE.map((category) => ({
        id: slugify(category.name),
        name: category.name,
        subcategories: category.subcategories.map((subcategory) => ({
          id: `${slugify(category.name)}-${slugify(subcategory)}`,
          name: subcategory
        }))
      }))
    }, { status: 200 });
  }

  return NextResponse.json({
    success: true,
    data: CATEGORY_TREE
  }, { status: 200 });
}
