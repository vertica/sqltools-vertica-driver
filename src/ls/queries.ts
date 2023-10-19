import queryFactory from '@sqltools/base-driver/dist/lib/factory';
import escapeTableName from '../escape-table';
import { IBaseQueries, ContextValue } from '@sqltools/types';

const describeTable: IBaseQueries['describeTable'] = queryFactory`
SELECT * FROM
  ${p => p.isView ? `V_CATALOG.VIEW_COLUMNS` : `V_CATALOG.COLUMNS`}
WHERE
  TABLE_NAME = '${p => p.label}'
  AND TABLE_SCHEMA = '${p => p.schema}'
`;

const fetchColumns: IBaseQueries['fetchColumns'] = queryFactory`
SELECT
  C.COLUMN_NAME AS label,
  '${ContextValue.COLUMN}' as type,
  C.TABLE_NAME AS table,
  C.DATA_TYPE AS "dataType",
  UPPER(C.DATA_TYPE) AS "detail",
  C.CHARACTER_MAXIMUM_LENGTH::INT AS size,
  '${p => p.database}' AS database,
  C.TABLE_SCHEMA AS schema,
  ${p => p.isView ? `NULL` : `C.COLUMN_DEFAULT`} AS "defaultValue",
  ${p => p.isView ? `NULL` : `C.IS_NULLABLE`} AS "isNullable",
  false as "isPk",
  false as "isFk"
FROM
  ${p => p.isView ? `V_CATALOG.VIEW_COLUMNS` : `V_CATALOG.COLUMNS`} C
WHERE
  C.TABLE_SCHEMA = '${p => p.schema}'
  AND C.TABLE_NAME = '${p => p.label}'
ORDER BY
  C.TABLE_NAME,
  C.ORDINAL_POSITION
`;

// apply to both tables and views
const fetchRecords: IBaseQueries['fetchRecords'] = queryFactory`
SELECT *
FROM ${p => escapeTableName(p.table)}
LIMIT ${p => p.limit || 50}
OFFSET ${p => p.offset || 0};
`;
// apply to both tables and views
const countRecords: IBaseQueries['countRecords'] = queryFactory`
SELECT count(1) AS total
FROM ${p => escapeTableName(p.table)};
`;

// For autocomplete
const searchTables: IBaseQueries['searchTables'] = queryFactory`
SELECT U.*, D.database_name AS database
  FROM (SELECT
      T.TABLE_NAME AS label,
      '${ContextValue.TABLE}' AS type,
      T.TABLE_SCHEMA AS schema,
      FALSE AS "isView",
      'table' AS description,
      ('"' || T.TABLE_SCHEMA || '"."' || T.TABLE_NAME || '"') as detail
    FROM V_CATALOG.TABLES AS T
  UNION
    SELECT
      V.TABLE_NAME AS label,
      '${ContextValue.VIEW}' AS type,
      V.TABLE_SCHEMA AS schema,
      TRUE AS "isView",
      'view' AS description,
      ('"' || V.TABLE_SCHEMA || '"."' || V.TABLE_NAME || '"') as detail
    FROM V_CATALOG.VIEWS AS V
) AS U, V_CATALOG.DATABASES AS D
${p => p.search ? `WHERE (
    U.label ILIKE '%${p.search}%'
    OR U.schema ILIKE '%${p.search}%'
  )` : ''}
ORDER BY
  U.label
LIMIT ${p => p.limit || 100};
`;

// For autocomplete
const searchColumns: IBaseQueries['searchColumns'] = queryFactory`
SELECT U.*, D.database_name AS database
  FROM (SELECT
      C.COLUMN_NAME AS label,
      '${ContextValue.COLUMN}' as type,
      C.TABLE_NAME AS table,
      C.DATA_TYPE AS "dataType",
      C.CHARACTER_MAXIMUM_LENGTH::INT AS size,
      C.TABLE_SCHEMA AS schema,
      C.COLUMN_DEFAULT AS defaultValue,
      C.IS_NULLABLE AS isNullable,
      ordinal_position,
      false as "isPk",
      false as "isFk"
    FROM V_CATALOG.COLUMNS AS C
  UNION
    SELECT
      V.COLUMN_NAME AS label,
      '${ContextValue.COLUMN}' as type,
      V.TABLE_NAME AS table,
      V.DATA_TYPE AS "dataType",
      V.CHARACTER_MAXIMUM_LENGTH::INT AS size,
      V.TABLE_SCHEMA AS schema,
      NULL AS defaultValue,
      NULL AS isNullable,
      ordinal_position,
      false as "isPk",
      false as "isFk"
    FROM V_CATALOG.VIEW_COLUMNS AS V
) AS U, V_CATALOG.DATABASES AS D
WHERE 1=1
  ${p => p.tables.filter(t => !!t.label).length
    ? `AND LOWER(U.table) IN (${p.tables.filter(t => !!t.label).map(t => `'${t.label}'`.toLowerCase()).join(', ')})`
    : ''
  }
  ${p => p.search
    ? `AND (
      (U.table || '.' || U.label) ILIKE '%${p.search}%'
      OR U.label ILIKE '%${p.search}%'
    )`
    : ''
  }
ORDER BY
  U.table,
  U.ordinal_position
LIMIT ${p => p.limit || 100}
`;

const fetchTables: IBaseQueries['fetchTables'] = queryFactory`
SELECT
  T.TABLE_NAME AS label,
  '${ContextValue.TABLE}' as type,
  T.TABLE_SCHEMA AS schema,
  '${p => p.database}' AS database,
  FALSE AS isView
FROM V_CATALOG.tables AS T
WHERE
  T.TABLE_SCHEMA = '${p => p.schema}'
  AND T.IS_SYSTEM_TABLE = 'f'
ORDER BY
  T.TABLE_NAME
`;

const fetchViews: IBaseQueries['fetchTables'] = queryFactory`
SELECT
  V.TABLE_NAME AS label,
  '${ContextValue.VIEW}' as type,
  V.TABLE_SCHEMA AS schema,
  '${p => p.database}' AS database,
  TRUE AS isView
FROM V_CATALOG.views AS V
WHERE
  V.TABLE_SCHEMA = '${p => p.schema}'
  AND V.IS_SYSTEM_VIEW = 'f'
ORDER BY
  V.TABLE_NAME
`;

const fetchDatabases: IBaseQueries['fetchDatabases'] = queryFactory`
SELECT
  database_name as "label",
  database_name as "database",
  '${ContextValue.DATABASE}' as "type",
  'database' as "detail"
FROM V_CATALOG.DATABASES
`;

const fetchSchemas: IBaseQueries['fetchSchemas'] = queryFactory`
SELECT
  schema_name AS label,
  schema_name AS schema,
  '${ContextValue.SCHEMA}' as "type",
  'group-by-ref-type' as "iconId",
  '${p => p.database}' as database
FROM V_CATALOG.SCHEMATA
WHERE
  IS_SYSTEM_SCHEMA = 'f'
ORDER BY schema_name
`;
// OR schema_name in ('v_catalog', 'v_monitor')
 
export default {
  describeTable,
  countRecords,
  fetchColumns,
  fetchRecords,
  fetchTables,
  fetchViews,
  fetchDatabases,
  fetchSchemas,
  searchTables,
  searchColumns,
};