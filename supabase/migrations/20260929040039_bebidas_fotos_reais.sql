WITH sem_acento AS (
  SELECT
    p.id,
    translate(lower(p.name),
              'áàâãäéèêëíìîïóòôõöúùûüç',
              'aaaaaeeeeiiiiooooouuuuc') AS n
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE (p.image_url IS NULL OR p.image_url LIKE '/cardapio/%')
    AND translate(lower(c.name),
                  'áàâãäéèêëíìîïóòôõöúùûüç',
                  'aaaaaeeeeiiiiooooouuuuc') LIKE '%bebida%'
),
foto AS (
  SELECT
    id,
    CASE
      WHEN n LIKE '%guarana%'
           AND (n LIKE '%lata%' OR n LIKE '%350%')
           AND n NOT LIKE '%zero%' AND n NOT LIKE '%light%' AND n NOT LIKE '%diet%'
        THEN 'https://commons.wikimedia.org/wiki/Special:FilePath/Lata%20de%20Guaran%C3%A1%20Antarctica.jpg?width=800'

      WHEN (n LIKE '%coca%' OR n ~ '(^|[^a-z])cola([^a-z]|$)' OR n LIKE '%refrigerante%')
           AND (n LIKE '%lata%' OR n LIKE '%350%')
           AND n NOT LIKE '%zero%' AND n NOT LIKE '%light%' AND n NOT LIKE '%diet%'
        THEN 'https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola%20lata.jpg?width=800'

      WHEN n LIKE '%laranja%' AND n NOT LIKE '%+%' AND n NOT LIKE '%acerola%' AND n NOT LIKE '%morango%'
        THEN 'https://commons.wikimedia.org/wiki/Special:FilePath/Orange%20juice%201%20edit1.jpg?width=800'
      WHEN n LIKE '%limao%'
        THEN 'https://commons.wikimedia.org/wiki/Special:FilePath/Limeade.jpg?width=800'
      WHEN n LIKE '%morango%' AND n NOT LIKE '%laranja%'
        THEN 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass%20of%20strawberry%20juice%2020180815.jpg?width=800'
      WHEN n LIKE '%manga%'
        THEN 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass%20of%20Mango%20Juice.jpg?width=800'

      ELSE NULL
    END AS url
  FROM sem_acento
)
UPDATE products p
   SET image_url = foto.url
  FROM foto
 WHERE foto.id = p.id
   AND foto.url IS NOT NULL;
