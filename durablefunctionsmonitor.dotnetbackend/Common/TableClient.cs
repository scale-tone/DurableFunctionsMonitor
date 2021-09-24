using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.WindowsAzure.Storage.Table;
using Microsoft.WindowsAzure.Storage;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // CloudTableClient wrapper interface. Seems to be the only way to unit-test.
    public interface ITableClient
    {
        CloudTable GetTableReference(string tableName);
        Task<IEnumerable<string>> ListTableNamesAsync();
    }

    // CloudTableClient wrapper. Seems to be the only way to unit-test.
    class TableClient: ITableClient
    {
        // Cannot use DI functionality (our startup method will not be called when installed as a NuGet package),
        // so just leaving this as an internal static variable.
        internal static ITableClient MockedTableClient = null;

        public static ITableClient GetTableClient(string connStringName)
        {
            if (MockedTableClient != null)
            {
                return MockedTableClient;
            }

            return new TableClient(connStringName);
        }

        private TableClient(string connStringName)
        {
            string connectionString = Environment.GetEnvironmentVariable(connStringName);
            this._client = CloudStorageAccount.Parse(connectionString).CreateCloudTableClient();
        }

        public CloudTable GetTableReference(string tableName)
        {
            return this._client.GetTableReference(tableName);
        }

        public async Task<IEnumerable<string>> ListTableNamesAsync()
        {
            var result = new List<string>();
            TableContinuationToken token = null;
            do
            {
                var nextBatch = await this._client.ListTablesSegmentedAsync(token);
                result.AddRange(nextBatch.Results.Select(r => r.Name));
                token = nextBatch.ContinuationToken;
            }
            while (token != null);
            return result;
        }

        private readonly CloudTableClient _client;
    }
}