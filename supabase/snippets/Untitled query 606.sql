SELECT
  item.slug,
  (
    SELECT count(*)
    FROM public.catalog_item_images AS image
    WHERE image.item_id = item.id
      AND image.organization_id = item.organization_id
  ) AS gallery_records,
  (
    SELECT count(*)
    FROM storage.objects AS object
    WHERE object.bucket_id = 'catalog-images'
      AND split_part(object.name, '/', 1) =
        item.organization_id::text
      AND split_part(object.name, '/', 2) = item.id::text
  ) AS stored_files
FROM public.catalog_items AS item
JOIN public.organizations AS organization
  ON organization.id = item.organization_id
WHERE organization.slug = 'test-company'
  AND item.slug IN ('cleanup-keep', 'cleanup-remove')
ORDER BY item.slug;