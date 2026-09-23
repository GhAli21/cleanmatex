SELECT table_schema,
       table_name,
       column_name,
       data_type,
       character_maximum_length,
       numeric_precision,
       numeric_scale
FROM information_schema.columns
WHERE column_name LIKE '%currency_%code%'
And data_type !='text'
ORDER BY table_schema, table_name, column_name
;
