import {Pool, Result, Field} from 'vertica-nodejs';
import Queries from './queries';
import { IConnectionDriver, NSDatabase, Arg0, ContextValue, MConnectionExplorer } from '@sqltools/types';
import AbstractDriver from '@sqltools/base-driver';
import QueryParser from './parser';
import { v4 as generateId } from 'uuid';
// import { inspect } from "util";  // For debug

type DriverLib = Pool;
type DriverOptions = any;

export default class VerticaSQL extends AbstractDriver<DriverLib, DriverOptions> implements IConnectionDriver {
  queries = Queries;

  public async open() {
    if (this.connection) {
      return this.connection;
    }

    // console.log('this.credentials:', JSON.stringify(this.credentials), '\n');

    let options = {
      user: this.credentials.username,
      host: this.credentials.server,
      database: this.credentials.database,
      password: this.credentials.password,
      port: this.credentials.port,
      client_label: this.credentials.label,
      tls_mode: this.credentials.tlsmode,
      workload: this.credentials.workload,
    }

    this.credentials.tls = this.credentials.tls || {};
    if (this.credentials.tls['ca']){
      options['tls_trusted_certs'] = this.credentials.tls['ca'].replace(/^file:\/\//, '')
    }

    // console.log('options:', JSON.stringify(options), '\n');

    const pool = new Pool(options);
    console.log("start client connection ......!!!!!")
    await pool.connect();
    this.connection = Promise.resolve(pool);
    return this.connection;
  }

  public async close() {
    if (!this.connection) return Promise.resolve();
    const pool = await this.connection;
    pool.end();
    this.connection = null;
  }

  public query: (typeof AbstractDriver)['prototype']['query'] = async (query, opt = {}) => {
    var pool = await this.open();
    const queries = QueryParser(query.toString(), 'pg');
    const resultsAgg: NSDatabase.IResult[] = [];
    const { requestId } = opt;

    for (const query of queries) {
      const res:Result = await pool.query(query);
      // For debug
      // console.log("Query: " + query);
      // console.log("Result: " + inspect(res.rows, { depth: null }));
      const cols = this.getColumnNames(res.fields || []);
      resultsAgg.push(
        {
          requestId,
          resultId: generateId(),
          connId: this.getId(),
          cols,
          messages: [{ date: new Date(), message: `Query ok with ${res.rows.length} results`}],
          query: query,
          results: res.rows,
        }
      );

    }
    return resultsAgg;
  }

  private getColumnNames(fields:Field): string[] {
    return fields.reduce((names, { name }) => {
      const count = names.filter((n) => n === name).length;
      return names.concat(count > 0 ? `${name} (${count})` : name);
    }, []);
  }

  private async getColumns(parent: NSDatabase.ITable): Promise<NSDatabase.IColumn[]> {
    const results = await this.queryResults(this.queries.fetchColumns(parent));
    return results.map(col => ({
      ...col,
      iconName: null,
      childType: ContextValue.NO_CHILD,
      table: parent
    }));
  }

  public async testConnection() {
    const pool = await this.open()
    const cli = await pool.connect();
    await cli.query('SELECT 1');
    cli.release();
  }

  public async getChildrenForItem({ item, parent }: Arg0<IConnectionDriver['getChildrenForItem']>) {
    switch (item.type) {
      case ContextValue.CONNECTION:
      case ContextValue.CONNECTED_CONNECTION:
        return this.queryResults(this.queries.fetchDatabases());
      case ContextValue.TABLE:
      case ContextValue.VIEW:
        return this.getColumns(item as NSDatabase.ITable);
      case ContextValue.DATABASE:
        return <MConnectionExplorer.IChildItem[]>[
          { label: 'Schemas', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.SCHEMA },
        ];
      case ContextValue.RESOURCE_GROUP:
        return this.getChildrenForGroup({ item, parent });
      case ContextValue.SCHEMA:
        return <MConnectionExplorer.IChildItem[]>[
          { label: 'Tables', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.TABLE },
          { label: 'Views', type: ContextValue.RESOURCE_GROUP, iconId: 'folder', childType: ContextValue.VIEW },
        ];
    }
    return [];
  }
  private async getChildrenForGroup({ parent, item }: Arg0<IConnectionDriver['getChildrenForItem']>) {
    switch (item.childType) {
      case ContextValue.SCHEMA:
        return this.queryResults(this.queries.fetchSchemas(parent as NSDatabase.IDatabase));
      case ContextValue.TABLE:
        return this.queryResults(this.queries.fetchTables(parent as NSDatabase.ISchema));
      case ContextValue.VIEW:
        return this.queryResults(this.queries.fetchViews(parent as NSDatabase.ISchema));
    }
    return [];
  }

  public searchItems(itemType: ContextValue, search: string, extraParams: any = {}): Promise<NSDatabase.SearchableItem[]> {
    switch (itemType) {
      case ContextValue.TABLE:
        return this.queryResults(this.queries.searchTables({ search }));
      case ContextValue.COLUMN:
        return this.queryResults(this.queries.searchColumns({ search, ...extraParams }));
    }
  }

  private completionsCache: { [w: string]: NSDatabase.IStaticCompletion } = null;
  public getStaticCompletions = async () => {
    if (this.completionsCache) return this.completionsCache;
    this.completionsCache = {};
    const items = await this.queryResults("SELECT UPPER(keyword) AS label, CASE WHEN reserved = 'R' THEN 'RESERVED' ELSE 'UNRESERVED' END AS reserved FROM keywords;");

    items.forEach((item: any) => {
      this.completionsCache[item.label] = {
        label: item.label,
        detail: item.label,
        filterText: item.label,
        sortText: (['SELECT', 'CREATE', 'UPDATE', 'DELETE'].includes(item.label) ? '2:' : '') + item.label,
        documentation: {
          value: `\`\`\`yaml\nWORD: ${item.label}\nTYPE: ${item.reserved}\n\`\`\``,
          kind: 'markdown'
        }
      }
    });

    return this.completionsCache;
  }
}
