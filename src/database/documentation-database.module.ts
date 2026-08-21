import { Global, Module } from '@nestjs/common';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

const repositoryStub = {} as never;

const runTransaction = <T>(...args: unknown[]): Promise<T> => {
  const runInTransaction = args.at(-1) as (manager: EntityManager) => T;
  return Promise.resolve(runInTransaction(entityManagerStub));
};

const entityManagerStub = {
  getRepository: () => repositoryStub,
  transaction: runTransaction,
  query: () => Promise.resolve([] as never),
} as unknown as EntityManager;

const dataSourceStub = {
  entityMetadatas: [],
  options: {
    type: 'mysql',
  },
  isInitialized: true,
  manager: entityManagerStub,
  getRepository: () => repositoryStub,
  getTreeRepository: () => repositoryStub,
  getMongoRepository: () => repositoryStub,
  createEntityManager: () => entityManagerStub,
  initialize: () => Promise.resolve(dataSourceStub as never),
  destroy: () => Promise.resolve(undefined),
  transaction: runTransaction,
  query: () => Promise.resolve([] as never),
} as unknown as DataSource;

const dataSourceToken = getDataSourceToken();
const entityManagerToken = getEntityManagerToken();
const dataSourceProviders =
  dataSourceToken === DataSource
    ? [
        {
          provide: dataSourceToken,
          useValue: dataSourceStub,
        },
      ]
    : [
        {
          provide: dataSourceToken,
          useValue: dataSourceStub,
        },
        {
          provide: DataSource,
          useValue: dataSourceStub,
        },
      ];
const dataSourceExportTokens =
  dataSourceToken === DataSource ? [DataSource] : [dataSourceToken, DataSource];

const entityManagerProviders =
  entityManagerToken === EntityManager
    ? [
        {
          provide: entityManagerToken,
          useValue: entityManagerStub,
        },
      ]
    : [
        {
          provide: entityManagerToken,
          useValue: entityManagerStub,
        },
        {
          provide: EntityManager,
          useValue: entityManagerStub,
        },
      ];
const entityManagerExportTokens =
  entityManagerToken === EntityManager
    ? [EntityManager]
    : [entityManagerToken, EntityManager];

@Global()
@Module({
  providers: [...dataSourceProviders, ...entityManagerProviders],
  exports: [...dataSourceExportTokens, ...entityManagerExportTokens],
})
export class DocumentationDatabaseModule {}
