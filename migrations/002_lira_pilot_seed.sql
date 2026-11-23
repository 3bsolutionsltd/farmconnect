INSERT INTO locations (parent_id, level, name, code)
SELECT NULL, 'district', 'Lira', 'UG-LI'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE parent_id IS NULL AND level = 'district' AND name = 'Lira');

INSERT INTO locations (parent_id, level, name)
SELECT district.id, 'subcounty', seed.name
FROM locations district
JOIN (
    SELECT 'Lira City East' AS name
    UNION ALL SELECT 'Lira City West'
    UNION ALL SELECT 'Adekokwok'
    UNION ALL SELECT 'Ojwina'
) seed
WHERE district.level = 'district' AND district.name = 'Lira'
  AND NOT EXISTS (SELECT 1 FROM locations existing WHERE existing.parent_id = district.id AND existing.level = 'subcounty' AND existing.name = seed.name);

INSERT INTO product_categories (name)
SELECT seed.name
FROM (
    SELECT 'Tree seedlings' AS name
    UNION ALL SELECT 'Crop seeds'
    UNION ALL SELECT 'Farm inputs'
    UNION ALL SELECT 'Equipment'
    UNION ALL SELECT 'Livestock'
) seed
WHERE NOT EXISTS (SELECT 1 FROM product_categories existing WHERE existing.parent_id IS NULL AND existing.name = seed.name);

INSERT INTO agricultural_products (category_id, name, description, unit)
SELECT category.id, seed.name, seed.description, 'seedlings'
FROM product_categories category
JOIN (
    SELECT 'Tree seedlings' AS category_name, 'Coffee seedlings' AS name, 'Coffee plantlets for smallholder and commercial farms.' AS description
    UNION ALL SELECT 'Tree seedlings', 'Avocado seedlings', 'Grafted and established avocado seedlings.'
    UNION ALL SELECT 'Tree seedlings', 'Mango seedlings', 'Mango seedlings for orchard establishment.'
    UNION ALL SELECT 'Tree seedlings', 'Citrus seedlings', 'Citrus seedlings for household and commercial orchards.'
    UNION ALL SELECT 'Tree seedlings', 'Eucalyptus seedlings', 'Eucalyptus seedlings for woodlots and farm boundaries.'
) seed ON seed.category_name = category.name
WHERE category.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM agricultural_products existing WHERE existing.category_id = category.id AND existing.name = seed.name);
