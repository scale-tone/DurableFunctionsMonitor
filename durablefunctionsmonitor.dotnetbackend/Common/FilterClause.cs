using System;
using System.Text.RegularExpressions;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // A parsed $filter clause
    class FilterClause
    {
        public FilterClause(string filterString)
        {
            if(filterString == null)
            {
                filterString = string.Empty;
            }

            var match = StartsWithRegex.Match(filterString);
            if (match.Success)
            {
                // startswith(field-name, 'value')
                this.Predicate = (v) => v.StartsWith(match.Groups[2].Value);
            }
            else
            {
                match = ContainsRegex.Match(filterString);
                if (match.Success)
                {
                    // contains(field-name, 'value')
                    this.Predicate = (v) => v.Contains(match.Groups[2].Value);
                }
                else
                {
                    match = EqRegex.Match(filterString);
                    if (match.Success)
                    {
                        // field-name eq 'value'
                        string value = match.Groups[2].Value;
                        this.Predicate = (v) =>
                        {
                            return value == "null" ? string.IsNullOrEmpty(v) : v == value;
                        };
                    }
                }
            }

            if (this.Predicate != null)
            {
                this.FieldName = match.Groups[1].Value;
            }
        }

        public Func<string, bool> Predicate { get; private set; }
        public string FieldName { get; private set; }

        private static readonly Regex StartsWithRegex = new Regex(@"startswith\((\w+),\s*'([^']+)'\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex ContainsRegex = new Regex(@"contains\((\w+),\s*'([^']+)'\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex EqRegex = new Regex(@"(\w+)\s*eq\s*'([^']+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}