using System;
using System.Text.RegularExpressions;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // A parsed $filter clause
    class FilterClause
    {
        public FilterClause(string filterString)
        {
            if (filterString == null)
            {
                filterString = string.Empty;
            }

            var match = StartsWithRegex.Match(filterString);
            if (match.Success)
            {
                // startswith(field-name, 'value') eq true|false

                bool result = true;
                if (match.Groups.Count > 4)
                {
                    result = match.Groups[4].Value != "false";
                }
                string arg = match.Groups[2].Value;

                this.Predicate = (v) => v.StartsWith(arg) == result;
            }
            else
            {
                match = ContainsRegex.Match(filterString);
                if (match.Success)
                {
                    // contains(field-name, 'value') eq true|false

                    bool result = true;
                    if (match.Groups.Count > 4)
                    {
                        result = match.Groups[4].Value != "false";
                    }
                    string arg = match.Groups[2].Value;

                    this.Predicate = (v) => v.Contains(arg) == result;
                }
                else
                {
                    match = EqRegex.Match(filterString);
                    if (match.Success)
                    {
                        // field-name eq|ne 'value'
                        string value = match.Groups[3].Value;
                        string op = match.Groups[2].Value;

                        this.Predicate = (v) =>
                        {
                            bool res = value == "null" ? string.IsNullOrEmpty(v) : v == value;

                            return op == "ne" ? !res : res;
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

        private static readonly Regex StartsWithRegex = new Regex(@"startswith\((\w+),\s*'([^']+)'\)\s*(eq)?\s*(true|false)?", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex ContainsRegex = new Regex(@"contains\((\w+),\s*'([^']+)'\)\s*(eq)?\s*(true|false)?", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex EqRegex = new Regex(@"(\w+)\s*(eq|ne)\s*'([^']+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}