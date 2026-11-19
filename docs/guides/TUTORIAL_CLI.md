# CLI Getting Started

note: in progress

Welcome to the tutorial for our ETL Madness flow. In this guide, we will walk you through the steps to set up and use the ETL flow effectively.

## Overview

In this tutorial, we will cover the basic steps to set up and use the ETL Madness flow, including installation, configuration, and running the flow command line interface (CLI).

## Prerequisites

Before you begin, ensure you have the following installed:

- Flow (go-flow) [https://github.com/etl-madness/go-flow](https://github.com/etl-madness/go-flow)
- Go 1.26 [https://golang.org/doc/install](https://golang.org/doc/install)

## Installation

Quick start by cloning the repository and building the Flow binary for your platform.
The following sections will guide you through building and installing Flow on different platforms.
There are multiple ways to install Flow depending on your operating system and preferences. The first set of examples will cover building and installing Flow from source, and installing locally, while the later section will cover installing using OS package formats.

### Installing Flow from Source locally

To install Flow from source locally, you need to clone the repository and build the binary for your platform. Follow the instructions for your operating system below.

#### Build and Install Flow on Linux, macOS, and FreeBSD

```bash
git clone https://github.com/etl-madness/go-flow.git
cd go-flow
go build -o flow .
sudo mv flow ~/.local/bin/flow
```

#### Build and Install Flow on Windows

```powershell
git clone https://github.com/etl-madness/go-flow.git
cd go-flow
go build -o flow.exe .
move flow.exe $env:LOCALAPPDATA\Programs\flow\flow.exe
```

### (Optional) Install using OS Package Formats

Follow the instructions in the packaging README to install Flow using your preferred OS package format.

[go-flow Packaging README](https://github.com/etl-madness/go-flow/blob/main/packaging/README.md)

### Getting Help

If you encounter any issues or have questions while using the ETL Madness flow, you can get help through the following channels:

- Check the [go-flow GitHub repository](https://github.com/etl-madness/go-flow) for issues and discussions.
- Refer to the [documentation](https://etl-madness.github.io/flow-docs/) for detailed guides and references.
- Join the community discussions or reach out to the maintainers for support.

## Running the Flow CLI

Once you have installed Flow, you can start using the CLI to run your ETL flows. The basic syntax for running Flow commands is:

```bash
flow <command> [flags]
```

To see a list of available commands and options, you can use:

```bash
flow -help
```

## Setting Up an ETL Flow

To set up an ETL flow using the Flow CLI, you typically need to define your flow configuration and then run the appropriate commands to execute it. The following steps outline the basic process:

1. Create a flow configuration file (e.g., `jobname.xml`) that defines your ETL steps and data sources.
2. Use the `flow run` command to execute the flow based on your configuration.

```bash
flow  -f jobname.xml
```

## Basic Pipeline

A basic ETL pipeline in Flow typically consists of defining your data sources, transformations, and destinations within the flow configuration file. Once defined, you can execute the pipeline using the Flow CLI as shown in the previous section.

### Start by identifying your data sources

In your flow configuration file, define the data sources that your ETL pipeline will extract data from. This could include databases, APIs, or flat files. Each data source should be properly configured with the necessary connection details and credentials.

#### Database Connections

Specify the database type, host, port, username, password, and database name. Ensure that the connection details are correctly formatted and that the necessary database drivers are available. These can be defined in variables or directly in the <databases/> section of your flow configuration file.

If you define a connection string as a variable, you can reference it in the database section using the `{{variable_name}}` syntax. This allows you to centralize your connection details and makes it easier to update them without modifying multiple sections of your flow configuration file. If you don't want to, you can include the connection string directly in the database section.

**Logging Database Connection**

If you want automatic logging to a database, flow will handle the logging for you, but you should define a dedicated logging database connection `log_db`. Once `log_db` is defined, Flow will use it to store logs related to the execution of your ETL pipeline, assuming you have correctly configured the connection details and have the necessary permissions to write to the logging database, and that the database schema supports the required logging tables.

Schema for the logging database can be found in detail under [DATABASE_LOGGING_CONFIGURATION.md](./DATABASE_LOGGING_CONFIGURATION.md)

**Defining Database Connections**

```xml jobname.xml

<pipeline xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/flow/main/xsd/pipeline.xsd"
          id="jobname">

    <variables>
        <variable name="target_cs" value="sqlserver://dbserver1.example.com:1433?database=EXAMPLE&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=jobname-target" type="string" />
         <variable name="source_cs" value="sqlserver://dbserver2.example.com:1433?database=EXAMPLE&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=jobname-source" type="string" />
        <variable name="log_db_cs" value="sqlserver://dbserver1.example.com:1433?database=EXAMPLE&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=jobname-logger" type="string" />
    </variables>

    <databases>
        <database name="log_db" driver="sqlserver" connection_string="{{log_db_cs}}" conn_max_lifetime_seconds="300" max_idle_conns="10" max_open_conns="25" />
        <database name="target_db" driver="sqlserver" connection_string="{{target_cs}}" conn_max_lifetime_seconds="300" max_idle_conns="10" max_open_conns="25" />
        <database name="source_db" driver="sqlserver" connection_string="{{source_cs}}" conn_max_lifetime_seconds="300" max_idle_conns="10" max_open_conns="25" />
    </databases>

</pipeline>

```

**Example SQL Processing**

Next, you can run your ETL pipeline using the Flow CLI, and it will automatically log the execution details to the `log_db` database as long as it is properly configured.

In this example, we create a table on the target database (`target_db`) to store the daily sales summary selected from the source database (`source_db`).

```xml jobname.xml

<pipeline xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/flow/main/xsd/pipeline.xsd"
          id="jobname">

    <variables>
        <variable name="target_cs" value="sqlserver://dbserver1.example.com:1433?database=EXAMPLE&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=jobname-target" 
        type="string" />
         <variable name="source_cs" value="sqlserver://dbserver2.example.com:1433?database=EXAMPLE&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=jobname-source" 
         type="string" />
        <variable name="log_db_cs" value="sqlserver://dbserver1.example.com:1433?database=EXAMPLE&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=jobname-logger" 
        type="string" />
    </variables>

    <databases>
        <database name="log_db" driver="sqlserver" connection_string="{{log_db_cs}}" />
        <database name="target_db" driver="sqlserver" connection_string="{{target_cs}}" conn_max_lifetime_seconds="300" max_idle_conns="10" max_open_conns="25" />
        <database name="source_db" driver="sqlserver" connection_string="{{source_cs}}" conn_max_lifetime_seconds="300" max_idle_conns="10" max_open_conns="25" />
    </databases>
    <flow>
        <sql id="create_daily_sales_summary_target_table" db="target_db">
        <![CDATA[
                DROP TABLE IF EXISTS daily_sales_summary ;
                CREATE TABLE daily_sales_summary (
                                customer_id INT NOT NULL,
                                total_amount INT NOT NULL,
                                order_count INT NOT NULL,
                                summary_date datetime2(7) NOT NULL
                            );
            ]]>
        </sql>

        <!-- Stream aggregated rows directly into SQLite -->
        <sql_bulk id="sync_daily_sales"
                  db="source_db"
                  target_db="target_db"
                  target_table="daily_sales_summary"
                  batch_size="5000"
                  output_var="ROWS_COPIED">
                     <![CDATA[
                        SELECT 
                            customer_id,
                            SUM(amount) AS total_amount,
                            COUNT(*) AS order_count,
                            order_date  AS summary_date
                        FROM orders
                        WHERE order_date >= DATEADD(day, -1, GETUTCDATE())
                        GROUP BY customer_id, order_date;
                    ]]>
        </sql_bulk>

    </flow>
</pipeline>

```

**Example Conditional Execution**

Lets say the source database contains an `WorkOrder` table with several columns but only want to process data modified on or after a certain date, specifically the `ModifiedDate` column. You want to copy latest workoders data from the source database to the target database only if there are available orders to copy and only sync the results to the target database if there are available orders. The XML configuration for such a pipeline would look like this:

```xml jobname.xml
<pipeline xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/etl-madness/flow/main/xsd/pipeline.xsd"
    id="jobname">

    <variables>
        <variable name="source_cs"
            value="sqlserver://db1.example.com:1433?database=AdventureWorks2019&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=jobname-source"
            type="string" />

        <variable name="target_cs"
            value="sqlserver://db2.example.com:1433?database=EXAMPLE&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=jobname-target" 
            type="string" />
        <variable name="log_db_cs" 
            value="sqlserver://db2.example.com:1433?database=EXAMPLE&amp;integrated+security=true&amp;trustServerCertificate=true&amp;app+name=log_db_cs" 
            type="string" />
    </variables>

    <databases>
        <database name="log_db" driver="sqlserver" connection_string="{{log_db_cs}}" />
        <database name="target_db" driver="sqlserver" connection_string="{{target_cs}}"/>
        <database name="source_db" driver="sqlserver" connection_string="{{source_cs}}"/>
    </databases>
    <flow>
        <sql id="check_if_daily_sales_is_present" db="target_db" output_var="available_orders">
            <![CDATA[
    
                    SELECT count(*) as available_orders
                    FROM [AdventureWorks2019].[Production].[WorkOrder]
                    WHERE [ModifiedDate] >= DATEADD(year, -20, GETDATE());
    
            ]]>
        </sql>
        <if id="check_daily_orders" var="available_orders" equals="0">
            <then>
                <template id="not_running_daily_sales" var="available_orders">
                    Available orders: {{.available_orders}}, not processing data.
                </template>
            </then>
            <else>
                <template id="running_daily_sales" var="available_orders">
                    Available orders: {{.available_orders}}, processing data.
                </template>

                <sql id="create_daily_sales_summary_target_table" db="target_db">
                    <![CDATA[
                        BEGIN
                        DROP TABLE IF EXISTS [WorkOrder];
                            CREATE TABLE [WorkOrder](
                                [WorkOrderID] [int] IDENTITY(1,1) NOT NULL,
                                [ProductID] [int] NOT NULL,
                                [OrderQty] [int] NOT NULL,
                                [StockedQty]  AS (isnull([OrderQty]-[ScrappedQty],(0))),
                                [ScrappedQty] [smallint] NOT NULL,
                                [StartDate] [datetime] NOT NULL,
                                [EndDate] [datetime] NULL,
                                [DueDate] [datetime] NOT NULL,
                                [ScrapReasonID] [smallint] NULL,
                                [ModifiedDate] [datetime] NOT NULL);

                        END
                    ]]>
                </sql>

                <!-- Stream aggregated rows directly into SQLite -->
                <sql_bulk id="sync_daily_workorders"
                    db="source_db"
                    target_db="target_db"
                    target_table="WorkOrder"
                    batch_size="5000"
                    output_var="ROWS_COPIED">
                            <![CDATA[
                                SELECT 
                                    [WorkOrderID],
                                    [ProductID],
                                    [OrderQty],
                                    [ScrappedQty],
                                    [StartDate],
                                    [EndDate],
                                    [DueDate],
                                    [ScrapReasonID],
                                    [ModifiedDate]
                                FROM [AdventureWorks2019].[Production].[WorkOrder]
                                WHERE [ModifiedDate] >= DATEADD(year, -20, GETDATE());
                            ]]>
                </sql_bulk>
                <sql id="workorder_copied_count" db="target_db" output_var="copied_orders">
                    <![CDATA[
            
                        SELECT count(*) as copied_orders
                            FROM [WorkOrder] ;
            
                    ]]>
                </sql>

                <template id="ReportResultsCopied" var="copied_orders">
                    Copied orders: {{.copied_orders}}, processing data.
                </template>
            </else>
        </if>
    </flow>
</pipeline>

```

**Running the Pipeline**

To run the pipeline, use the following command in your terminal:

The command below runs the pipeline defined in your XML file with streaming output and node-level logging enabled.
By adding the `-format stream` flag, the output will be streamed in real-time.
The `-node-output true` flag enables logging at the node level, providing detailed information about each step in the pipeline.

```bash
flow  -f path/to/your/pipeline.xml -format stream -node-output true
```

The logging results would look similar to the following, showing detailed information for each node in the pipeline as it executes:

```sql
SELECT TOP (3) [run_id]
      ,RIGHT([file_path],11) as job_name
      ,[status]
      ,[started_at]
      ,[finished_at]
      ,[duration_ms]
      ,[task_count]
  --  ,[user_name]
  --  ,[os_user_name]
  --  ,[db_user_name]
      ,[spid]
      ,[application_name]
  --  ,[hostname]
      ,[error_message]
      ,[created_at]
  FROM [dbo].[pipeline_runs]
  order by created_at desc;
```

`query results`

|run_id|job_name|status|started_at|finished_at|duration_ms|task_count|spid|application_name|error_message|created_at|
|------------|------------|------------|------------|------------|------------|------------|------------|------------|------------|------------|
|63c4f148b22604fcc31005ec3fef6e47|jobname.xml|succeeded|2026-11-19 01:02:59.3549922 +00:00|2026-11-19 01:02:59.9779761 +00:00|622|2|91|log_db_cs||2026-11-19 01:02:59.9788144 +00:00|
|0f3d05ff2716a90bd8ee0598587f96e4|jobname.xml|succeeded|2026-11-19 00:53:22.9502166 +00:00|2026-11-19 00:53:23.5885658 +00:00|638|2|56|log_db_cs||2026-11-19 00:53:23.5892341 +00:00|
|360d218f1e3cf0cdf08723376adc5ea2|jobname.xml|succeeded|2026-11-19 00:52:38.2821001 +00:00|2026-11-19 00:52:38.3916241 +00:00|109|2|55|log_db_cs||2026-11-19 00:52:38.3926918 +00:00|

`use run_id` to query against the `dbo.pipeline_events` table.

**Querying Pipeline Events**

```sql
SELECT [run_id]
      ,[execution_id]
      ,[sequence_num]
      ,[occurred_at]
      ,[event_type]
      ,[node_kind]
      ,[node_id]
      ,[status]
     -- ,[user_name]
     -- ,[os_user_name]
    --  ,[db_user_name]
      ,[spid]
      ,[application_name]
    --  ,[hostname]
    --  ,[options_path]
      ,[error_message]
      ,[rows_read]
      ,[rows_written]
      ,[rows_affected]
      ,[created_at]
      ,[node_output]
  FROM [dbo].[pipeline_events]
  where run_id='63c4f148b22604fcc31005ec3fef6e47'
  ```

`query results` for the pipeline events would look similar to the following:
 
| run_id | execution_id | sequence_num | occurred_at | event_type | node_kind | node_id | status | spid | application_name | error_message | rows_read | rows_written | rows_affected | created_at | node_output |
|---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|
|63c4f148b22604fcc31005ec3fef6e47||1|2026-11-19 01:02:59.4045517 +00:00|run.started|||succeeded|91|log_db_cs||0|0|0|2026-11-19 01:02:59.4051635 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|a445d79a2048d377c9a5e6ad55c8fdd9|2|2026-11-19 01:02:59.4073984 +00:00|node.started|sql|check_if_daily_sales_is_present||97|jobname-target||0|0|0|2026-11-19 01:02:59.4232469 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|a445d79a2048d377c9a5e6ad55c8fdd9|3|2026-11-19 01:02:59.4242314 +00:00|attempt.started|sql|check_if_daily_sales_is_present||97|jobname-target||0|0|0|2026-11-19 01:02:59.4242314 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|a445d79a2048d377c9a5e6ad55c8fdd9|4|2026-11-19 01:02:59.4455779 +00:00|attempt.finished|sql|check_if_daily_sales_is_present|succeeded|97|jobname-target||1|0|0|2026-11-19 01:02:59.4455779 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|a445d79a2048d377c9a5e6ad55c8fdd9|5|2026-11-19 01:02:59.4467737 +00:00|node.finished|sql|check_if_daily_sales_is_present|succeeded|97|jobname-target||1|0|0|2026-11-19 01:02:59.4467737 +00:00|available_orders|
|63c4f148b22604fcc31005ec3fef6e47|a445d79a2048d377c9a5e6ad55c8fdd9|5|2026-11-19 01:02:59.4467737 +00:00|node.finished|sql|check_if_daily_sales_is_present|succeeded|97|jobname-target||1|0|0|2026-11-19 01:02:59.4467737 +00:00|available_orders|(1 row(s) returned)|
|63c4f148b22604fcc31005ec3fef6e47|d0a77ad41e5483edb94b498b2ffe9700|6|2026-11-19 01:02:59.4479452 +00:00|node.started|if|||91|log_db_cs||0|0|0|2026-11-19 01:02:59.4479452 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|d0a77ad41e5483edb94b498b2ffe9700|7|2026-11-19 01:02:59.4484519 +00:00|attempt.started|if|||91|log_db_cs||0|0|0|2026-11-19 01:02:59.4493665 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|57126e8664014d99851675b7587b278e|8|2026-11-19 01:02:59.4498913 +00:00|node.started|template|running_daily_sales||91|log_db_cs||0|0|0|2026-11-19 01:02:59.4505774 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|57126e8664014d99851675b7587b278e|9|2026-11-19 01:02:59.4510805 +00:00|attempt.started|template|running_daily_sales||91|log_db_cs||0|0|0|2026-11-19 01:02:59.4517111 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|57126e8664014d99851675b7587b278e|10|2026-11-19 01:02:59.4527827 +00:00|attempt.finished|template|running_daily_sales|succeeded|91|log_db_cs||0|0|0|2026-11-19 01:02:59.4527827 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|57126e8664014d99851675b7587b278e|11|2026-11-19 01:02:59.4532892 +00:00|node.finished|template|running_daily_sales|succeeded|91|log_db_cs||0|0|0|2026-11-19 01:02:59.4542490 +00:00|Available orders: 72591, processing data.|
|63c4f148b22604fcc31005ec3fef6e47|bf4472d39b40278e866ebdd5e8ccc2bd|12|2026-11-19 01:02:59.4547568 +00:00|node.started|sql|create_daily_sales_summary_target_table||97|jobname-target||0|0|0|2026-11-19 01:02:59.4547568 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|bf4472d39b40278e866ebdd5e8ccc2bd|13|2026-11-19 01:02:59.4562045 +00:00|attempt.started|sql|create_daily_sales_summary_target_table||97|jobname-target||0|0|0|2026-11-19 01:02:59.4562045 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|bf4472d39b40278e866ebdd5e8ccc2bd|14|2026-11-19 01:02:59.4648842 +00:00|attempt.finished|sql|create_daily_sales_summary_target_table|succeeded|97|jobname-target||0|0|0|2026-11-19 01:02:59.4654059 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|bf4472d39b40278e866ebdd5e8ccc2bd|15|2026-11-19 01:02:59.4659116 +00:00|node.finished|sql|create_daily_sales_summary_target_table|succeeded|97|jobname-target||0|0|0|2026-11-19 01:02:59.4665148 +00:00|NULL|(0 row(s) returned)|
|63c4f148b22604fcc31005ec3fef6e47|9dd49cf1a80d3243df7ffafb25c611c2|16|2026-11-19 01:02:59.4670190 +00:00|node.started|sql_bulk|sync_daily_sales||99->97|jobname-source->jobname-target||0|0|0|2026-11-19 01:02:59.4900273 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|9dd49cf1a80d3243df7ffafb25c611c2|17|2026-11-19 01:02:59.4913907 +00:00|attempt.started|sql_bulk|sync_daily_sales||99->97|jobname-source->jobname-target||0|0|0|2026-11-19 01:02:59.4913907 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|9dd49cf1a80d3243df7ffafb25c611c2|18|2026-11-19 01:02:59.9043043 +00:00|attempt.finished|sql_bulk|sync_daily_sales|succeeded|99->97|jobname-source->jobname-target||72591|72591|0|2026-11-19 01:02:59.9050514 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|9dd49cf1a80d3243df7ffafb25c611c2|19|2026-11-19 01:02:59.9057126 +00:00|node.finished|sql_bulk|sync_daily_sales|succeeded|99->97|jobname-source->jobname-target||72591|72591|0|2026-11-19 01:02:59.9068598 +00:00|Streamed 72591 row(s) directly to target_db.WorkOrder|
|63c4f148b22604fcc31005ec3fef6e47|da14938a99fce5b180180572357de283|20|2026-11-19 01:02:59.9068598 +00:00|node.started|sql|workorder_copied_count||97|jobname-target||0|0|0|2026-11-19 01:02:59.9077282 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|da14938a99fce5b180180572357de283|21|2026-11-19 01:02:59.9106579 +00:00|attempt.started|sql|workorder_copied_count||97|jobname-target||0|0|0|2026-11-19 01:02:59.9111077 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|da14938a99fce5b180180572357de283|22|2026-11-19 01:02:59.9295312 +00:00|attempt.finished|sql|workorder_copied_count|succeeded|97|jobname-target||1|0|0|2026-11-19 01:02:59.9301852 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|da14938a99fce5b180180572357de283|23|2026-11-19 01:02:59.9308424 +00:00|node.finished|sql|workorder_copied_count|succeeded|97|jobname-target||1|0|0|2026-11-19 01:02:59.9314049 +00:00|copied_orders|72591|(1 row(s) returned)|
|63c4f148b22604fcc31005ec3fef6e47|962b5c5bc8d01e5e76b82c107778e876|24|2026-11-19 01:02:59.9327928 +00:00|node.started|template|ReportResultsCopied||91|log_db_cs||0|0|0|2026-11-19 01:02:59.9327928 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|962b5c5bc8d01e5e76b82c107778e876|25|2026-11-19 01:02:59.9340604 +00:00|attempt.started|template|ReportResultsCopied||91|log_db_cs||0|0|0|2026-11-19 01:02:59.9340604 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|962b5c5bc8d01e5e76b82c107778e876|26|2026-11-19 01:02:59.9346338 +00:00|attempt.finished|template|ReportResultsCopied|succeeded|91|log_db_cs||0|0|0|2026-11-19 01:02:59.9354308 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|962b5c5bc8d01e5e76b82c107778e876|27|2026-11-19 01:02:59.9359767 +00:00|node.finished|template|ReportResultsCopied|succeeded|91|log_db_cs||0|0|0|2026-11-19 01:02:59.9370415 +00:00|Copied orders: 72591, not processing data.|
|63c4f148b22604fcc31005ec3fef6e47|d0a77ad41e5483edb94b498b2ffe9700|28|2026-11-19 01:02:59.9378981 +00:00|attempt.finished|if||succeeded|91|log_db_cs||0|0|0|2026-11-19 01:02:59.9378981 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47|d0a77ad41e5483edb94b498b2ffe9700|29|2026-11-19 01:02:59.9384593 +00:00|node.finished|if||succeeded|91|log_db_cs||0|0|0|2026-11-19 01:02:59.9390853 +00:00|NULL|
|63c4f148b22604fcc31005ec3fef6e47||30|2026-11-19 01:02:59.9396654 +00:00|run.finished|||succeeded|91|log_db_cs||72593|72591|0|2026-11-19 01:02:59.9405670 +00:00|NULL|
